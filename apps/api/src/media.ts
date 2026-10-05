import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Request, Response } from "express";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { SessionUser } from "@wholesale/shared";
import {
  AuthModule,
  type AuthRequest,
  AuthService,
  cookieName,
  SessionGuard,
} from "./auth";
import { Database } from "./database";
@Injectable()
export class MediaService {
  private readonly localRoot = path.resolve(
    process.env.WHOLESALE_ROOT || process.cwd(),
    process.env.LOCAL_STORAGE_PATH || ".data/uploads",
  );
  private readonly s3 =
    process.env.STORAGE_MODE === "s3"
      ? new S3Client({
          region: process.env.S3_REGION || "auto",
          ...(process.env.S3_ENDPOINT
            ? { endpoint: process.env.S3_ENDPOINT }
            : {}),
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID!,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
          },
        })
      : null;
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}
  async upload(
    actor: SessionUser,
    file: Express.Multer.File | undefined,
    kind: string,
  ) {
    if (!file) throw new BadRequestException("Choose a file to upload");
    if (!["PRODUCT", "KYC"].includes(kind))
      throw new BadRequestException("Invalid upload type");
    if (
      kind === "PRODUCT" &&
      (!actor.businessId ||
        !actor.permissions.some((p) =>
          ["PRODUCTS:CREATE", "PRODUCTS:EDIT"].includes(p),
        ))
    )
      throw new ForbiddenException("Catalog permission is required");
    if (
      kind === "KYC" &&
      !(
        actor.role === "SELLER" ||
        (actor.businessId && actor.permissions.includes("SETTINGS:EDIT"))
      )
    )
      throw new ForbiddenException("Profile edit permission is required");
    let buffer: Buffer, mime: string, extension: string;
    if (
      kind === "KYC" &&
      file.mimetype === "application/pdf" &&
      file.buffer.subarray(0, 5).toString() === "%PDF-"
    ) {
      buffer = file.buffer;
      mime = "application/pdf";
      extension = "pdf";
    } else {
      try {
        const meta = await sharp(file.buffer, {
          limitInputPixels: 25000000,
        }).metadata();
        if (!["jpeg", "png", "webp"].includes(meta.format || ""))
          throw new Error("Format");
        buffer = await sharp(file.buffer, { limitInputPixels: 25000000 })
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toBuffer();
        mime = "image/webp";
        extension = "webp";
      } catch {
        throw new BadRequestException(
          "Upload a JPEG, PNG or WebP image (up to 8 MB), or a PDF for verification",
        );
      }
    }
    const key = `${randomUUID()}.${extension}`;
    if (this.s3)
      await this.s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mime,
        }),
      );
    else {
      await mkdir(this.localRoot, { recursive: true });
      await writeFile(path.join(this.localRoot, key), buffer);
    }
    const upload = await this.db.upload.create({
      data: {
        businessId: actor.businessId,
        userId: actor.id,
        kind,
        mime,
        size: buffer.length,
        storageKey: key,
        fileName: file.originalname
          .replace(/[^a-zA-Z0-9._ -]/g, "_")
          .slice(0, 150),
      },
    });
    return {
      id: upload.id,
      url: `/api/v1/media/${upload.id}`,
      fileName: upload.fileName,
    };
  }
  async read(id: string, req: Request, res: Response) {
    const record = await this.db.upload.findUnique({
      where: { id },
      include: {
        product: {
          include: { business: { select: { verificationStatus: true } } },
        },
      },
    });
    if (!record) throw new NotFoundException();
    const actor = await this.auth.current(req.cookies?.[cookieName()]);
    const platform =
      actor && ["PLATFORM_ADMIN", "PLATFORM_OPERATIONS"].includes(actor.role);
    const own =
      actor &&
      (actor.id === record.userId ||
        (record.businessId && actor.businessId === record.businessId));
    const publicImage =
      record.kind === "PRODUCT" &&
      record.product?.moderation === "APPROVED" &&
      record.product.business.verificationStatus === "VERIFIED";
    if (!publicImage && !own && !platform) throw new NotFoundException();
    if (
      record.kind === "KYC" &&
      own &&
      !platform &&
      actor?.id !== record.userId &&
      !actor?.permissions.includes("SETTINGS:VIEW")
    )
      throw new ForbiddenException();
    if (!/^[a-zA-Z0-9_.-]+$/.test(record.storageKey))
      throw new NotFoundException();
    let buffer: Buffer;
    if (this.s3) {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: record.storageKey,
        }),
      );
      if (!response.Body) throw new NotFoundException();
      buffer = Buffer.from(await response.Body.transformToByteArray());
    } else {
      try {
        buffer = await readFile(path.join(this.localRoot, record.storageKey));
      } catch {
        throw new NotFoundException("Image file is unavailable");
      }
    }
    res.setHeader("Content-Type", record.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Cache-Control",
      publicImage ? "public, max-age=300" : "private, no-store",
    );
    if (record.kind === "KYC")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${record.fileName.replaceAll('"', "")}"`,
      );
    res.send(buffer);
  }
}
@Controller("v1")
export class MediaController {
  constructor(
    @Inject(MediaService) private readonly media: MediaService,
    @Inject(Database) private readonly db: Database,
  ) {}
  @Post("uploads")
  @UseGuards(SessionGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query("kind") kind: string,
    @Query("businessId") businessId?: string,
  ) {
    let actor = req.actor;
    if (businessId) {
      if (
        !["PLATFORM_ADMIN", "PLATFORM_OPERATIONS"].includes(actor.role) ||
        kind !== "PRODUCT"
      )
        throw new ForbiddenException();
      const business = await this.db.business.findFirst({
        where: { id: businessId, verificationStatus: { not: "SUSPENDED" } },
      });
      if (!business) throw new NotFoundException("Business not found");
      actor = {
        ...actor,
        businessId: business.id,
        permissions: ["PRODUCTS:CREATE", "PRODUCTS:EDIT"],
      };
    }
    return this.media.upload(actor, file, kind || "PRODUCT");
  }
  @Get("media/:id") read(
    @Param("id") id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.media.read(id, req, res);
  }
}
@Module({
  imports: [AuthModule],
  providers: [MediaService],
  controllers: [MediaController],
})
export class MediaModule {}
