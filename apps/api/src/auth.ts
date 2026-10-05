import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Module,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  actions,
  businessSchema,
  modules,
  requestOtpSchema,
  sellerSchema,
  verifyOtpSchema,
  type ModuleKey,
  type Permission,
  type PermissionAction,
  type Role,
  type SessionUser,
} from "@wholesale/shared";
import { Database, audit } from "./database";
import { parse } from "./validation";
export type AuthRequest = Request & { actor: SessionUser };
export const cookieName = () =>
  process.env.NODE_ENV === "production"
    ? "__Host-wholesale_session"
    : "wholesale_session";
export const developmentAuth = () =>
  process.env.AUTH_MODE === "development" &&
  process.env.NODE_ENV !== "production";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const otpHash = (phone: string, code: string) =>
  createHmac("sha256", process.env.OTP_HASH_SECRET!)
    .update(`${phone}:${code}`)
    .digest("hex");
const sessionCookie = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
export const AllowRoles = (...roles: Role[]) => SetMetadata("roles", roles);
export const Ability = (module: ModuleKey, action: PermissionAction) =>
  SetMetadata("ability", `${module}:${action}`);

@Injectable()
export class AuthService {
  constructor(@Inject(Database) private readonly db: Database) {}
  async current(token?: string): Promise<SessionUser | null> {
    if (!token || token.length > 256) return null;
    const session = await this.db.session.findUnique({
      where: { tokenHash: hash(token) },
      include: {
        user: {
          include: {
            business: { include: { plan: true } },
            staff: { include: { business: { include: { plan: true } } } },
            seller: true,
          },
        },
      },
    });
    if (!session || session.expiresAt <= new Date() || session.user.disabled)
      return null;
    const u = session.user;
    if (u.role === "WHOLESALER_STAFF" && !u.staff?.active) return null;
    const business =
      u.role === "WHOLESALER_OWNER"
        ? u.business
        : u.role === "WHOLESALER_STAFF"
          ? u.staff?.business
          : null;
    if (
      business?.verificationStatus === "SUSPENDED" ||
      u.seller?.verificationStatus === "SUSPENDED"
    )
      return null;
    return {
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      businessId: business?.id ?? null,
      businessName: business?.name ?? null,
      sellerId: u.seller?.id ?? null,
      verificationStatus:
        business?.verificationStatus ?? u.seller?.verificationStatus ?? null,
      hasGst: !!business?.gstNumber,
      permissions:
        u.role === "WHOLESALER_OWNER"
          ? modules.flatMap((m) =>
              actions.map((a) => `${m}:${a}` as Permission),
            )
          : ((u.staff?.permissions as Permission[]) ?? []),
      onboardingRequired:
        u.role === "WHOLESALER_OWNER"
          ? !business
          : u.role === "SELLER"
            ? !u.seller
            : false,
      ...(business
        ? {
            plan: {
              name: business.plan.name,
              staffLimit: business.plan.staffLimit,
              productLimit: business.plan.productLimit,
              monthlyPricePaise: business.plan.monthlyPricePaise,
              bulkImport: business.plan.bulkImport,
              advancedReports: business.plan.advancedReports,
            },
          }
        : {}),
    };
  }
  async request(body: unknown) {
    const input = parse(requestOtpSchema, body);
    const code = String(randomInt(100000, 1000000));
    const challenge = await this.db.serial(async (tx) => {
      const now = new Date();
      const recent = await tx.otpChallenge.findFirst({
        where: {
          phone: input.phone,
          createdAt: { gt: new Date(now.getTime() - 60000) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (recent)
        throw new BadRequestException(
          "Please wait 60 seconds before requesting another code",
        );
      const count = await tx.otpChallenge.count({
        where: {
          phone: input.phone,
          createdAt: { gt: new Date(now.getTime() - 3600000) },
        },
      });
      if (count >= 5)
        throw new BadRequestException(
          "Too many OTP requests. Try again in an hour",
        );
      return tx.otpChallenge.create({
        data: {
          phone: input.phone,
          accountType: input.accountType,
          codeHash: otpHash(input.phone, code),
          expiresAt: new Date(now.getTime() + 300000),
        },
      });
    });
    if (!developmentAuth()) {
      if (!process.env.MSG91_AUTH_KEY || !process.env.MSG91_TEMPLATE_ID)
        throw new ServiceUnavailableException(
          "SMS login is not configured. Contact the platform administrator",
        );
      try {
        const url = new URL("https://control.msg91.com/api/v5/otp");
        url.searchParams.set("template_id", process.env.MSG91_TEMPLATE_ID);
        url.searchParams.set("mobile", `91${input.phone}`);
        url.searchParams.set("otp", code);
        url.searchParams.set("otp_length", "6");
        url.searchParams.set("otp_expiry", "5");
        const response = await fetch(url, {
          method: "POST",
          headers: {
            authkey: process.env.MSG91_AUTH_KEY,
            "Content-Type": "application/json",
          },
          body: "{}",
          signal: AbortSignal.timeout(10000),
        });
        const data = (await response.json()) as { type?: string };
        if (!response.ok || data.type !== "success")
          throw new Error("OTP delivery failed");
      } catch {
        await this.db.otpChallenge.update({
          where: { id: challenge.id },
          data: { consumedAt: new Date() },
        });
        throw new ServiceUnavailableException(
          "Could not deliver the OTP. Try again after a minute",
        );
      }
    }
    return {
      challengeId: challenge.id,
      expiresIn: 300,
      ...(developmentAuth() ? { developmentCode: code } : {}),
    };
  }
  async verify(body: unknown, res: Response) {
    const input = parse(verifyOtpSchema, body);
    const challenge = await this.db.otpChallenge.findUnique({
      where: { id: input.challengeId },
    });
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.attempts >= 5
    )
      throw new UnauthorizedException("Code expired. Request a new OTP");
    const attempts = await this.db.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        attempts: { lt: 5 },
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { attempts: { increment: 1 } },
    });
    if (!attempts.count)
      throw new UnauthorizedException("Code expired. Request a new OTP");
    const submitted = otpHash(challenge.phone, input.code);
    if (
      !challenge.codeHash ||
      !timingSafeEqual(Buffer.from(submitted), Buffer.from(challenge.codeHash))
    )
      throw new UnauthorizedException("Incorrect verification code");
    const token = randomBytes(32).toString("base64url");
    await this.db.serial(async (tx) => {
      const used = await tx.otpChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (!used.count)
        throw new UnauthorizedException("This code has already been used");
      const user = await tx.user.upsert({
        where: { phone: challenge.phone },
        create: {
          phone: challenge.phone,
          name: "New member",
          role: challenge.accountType,
        },
        update: {},
      });
      if (user.disabled)
        throw new ForbiddenException("This account is suspended");
      await tx.session.create({
        data: {
          tokenHash: hash(token),
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });
    const actor = await this.current(token);
    if (!actor) {
      await this.db.session.deleteMany({ where: { tokenHash: hash(token) } });
      throw new ForbiddenException(
        "This account or business is currently disabled",
      );
    }
    res.cookie(cookieName(), token, sessionCookie());
    return actor;
  }
  async logout(token: string | undefined, res: Response) {
    if (token)
      await this.db.session.deleteMany({ where: { tokenHash: hash(token) } });
    res.clearCookie(cookieName(), sessionCookie());
    return { ok: true };
  }
  async onboard(actor: SessionUser, body: unknown) {
    if (!actor.onboardingRequired)
      throw new BadRequestException("Your profile is already set up");
    if (actor.role === "WHOLESALER_OWNER") {
      const input = parse(
        businessSchema.extend({ ownerName: z.string().trim().min(2).max(80) }),
        body,
      );
      const plan = await this.db.plan.findFirst({
        where: { active: true },
        orderBy: { monthlyPricePaise: "asc" },
      });
      if (!plan)
        throw new ServiceUnavailableException(
          "No subscription plan is available",
        );
      await this.db.serial(async (tx) => {
        await tx.user.update({
          where: { id: actor.id },
          data: { name: input.ownerName },
        });
        const { ownerName: _, ...business } = input;
        const shop = await tx.business.create({
          data: { ...business, ownerId: actor.id, planId: plan.id },
        });
        await audit(
          tx,
          actor.id,
          shop.id,
          "BUSINESS_CREATED",
          shop.id,
          "Business submitted for platform review",
        );
      });
    } else if (actor.role === "SELLER") {
      const input = parse(sellerSchema, body);
      await this.db.serial(async (tx) => {
        const { name, ...data } = input;
        await tx.user.update({ where: { id: actor.id }, data: { name } });
        await tx.seller.create({ data: { ...data, userId: actor.id } });
      });
    } else throw new ForbiddenException();
    return { ok: true };
  }
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const actor = await this.auth.current(req.cookies?.[cookieName()]);
    if (!actor) throw new UnauthorizedException("Please sign in to continue");
    req.actor = actor;
    if (
      actor.onboardingRequired &&
      !this.reflector.getAllAndOverride<boolean>("allowIncomplete", [
        context.getHandler(),
        context.getClass(),
      ])
    )
      throw new ForbiddenException(
        "Complete your profile before using this workspace",
      );
    const roles = this.reflector.getAllAndOverride<Role[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && !roles.includes(actor.role))
      throw new ForbiddenException("Your role cannot access this workspace");
    const permission = this.reflector.getAllAndOverride<Permission>("ability", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (
      permission &&
      (!actor.businessId || !actor.permissions.includes(permission))
    )
      throw new ForbiddenException(
        "You do not have permission for this action",
      );
    return true;
  }
}
@Controller("v1/auth")
@SetMetadata("allowIncomplete", true)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post("request") request(@Body() body: unknown) {
    return this.auth.request(body);
  }
  @Post("verify") verify(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.verify(body, res);
  }
  @Get("me") @UseGuards(SessionGuard) me(@Req() req: AuthRequest) {
    return req.actor;
  }
  @Post("logout") logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.logout(req.cookies?.[cookieName()], res);
  }
  @Post("onboard") @UseGuards(SessionGuard) onboard(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.auth.onboard(req.actor, body);
  }
}
@Module({
  providers: [AuthService, SessionGuard],
  controllers: [AuthController],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
