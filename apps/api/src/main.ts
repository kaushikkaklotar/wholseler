import "reflect-metadata";
import { config } from "dotenv";
import path from "node:path";
import { NestFactory } from "@nestjs/core";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Request, Response, NextFunction } from "express";
import { json } from "express";
import { AppModule } from "./module";
import { assertProductionConfig, productionDataChecks } from "./production";
import { Database } from "./database";
config({
  path: path.resolve(process.env.WHOLESALE_ROOT || process.cwd(), ".env"),
  quiet: true,
});
@Catch()
class Errors implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (
      typeof exception === "object" &&
      exception !== null &&
      "type" in exception &&
      exception.type === "entity.too.large"
    ) {
      res.status(413).json({
        message:
          "Import request is too large. Use fewer rows or shorter descriptions",
      });
      return;
    }
    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json({
        message:
          typeof exception.getResponse() === "string"
            ? exception.getResponse()
            : (exception.getResponse() as { message?: unknown }).message,
      });
      return;
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const code = exception.code;
      if (code === "P2002") {
        res.status(409).json({
          message: "This record already exists. Refresh and try again",
        });
        return;
      }
      if (code === "P2034") {
        res.status(409).json({
          message: "Stock changed while saving. Refresh and try again",
        });
        return;
      }
      if (code === "P2025") {
        res.status(404).json({ message: "Record not found" });
        return;
      }
    }
    Logger.error(
      exception instanceof Error ? exception.message : "Unknown error",
      "Request",
    );
    res
      .status(500)
      .json({ message: "Unable to complete this request. Try again" });
  }
}
async function bootstrap() {
  const production = process.env.NODE_ENV === "production";
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!process.env.OTP_HASH_SECRET || process.env.OTP_HASH_SECRET.length < 32)
    throw new Error("OTP_HASH_SECRET must have at least 32 characters");
  if (production) assertProductionConfig(process.env);
  const origin = process.env.WEB_ORIGIN || "http://127.0.0.1:3000";
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  if (production) {
    try {
      const checks = await productionDataChecks(
        app.get(Database),
        process.env.WHOLESALE_ROOT || process.cwd(),
      );
      const failures = checks.filter((c) => c.status === "FAIL");
      if (failures.length)
        throw new Error(
          `Production database blocked: ${failures.map((c) => c.id).join(", ")}. Run npm run launch:check.`,
        );
    } catch (error) {
      await app.close();
      if (
        error instanceof Error &&
        error.message.startsWith("Production database blocked:")
      )
        throw error;
      throw new Error(
        "Production database assessment failed. Check connectivity, migrations and bootstrap.",
      );
    }
  }
  app.use(json({ limit: "2mb" }));
  app.enableShutdownHooks();
  app.useGlobalFilters(new Errors());
  app.getHttpAdapter().getInstance().set("trust proxy", "loopback");
  app.use(helmet());
  app.use(cookieParser());
  const requestWindows = new Map<string, { start: number; count: number }>();
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const allowed = production
        ? [origin]
        : [origin, origin.replace("127.0.0.1", "localhost")];
      if (!req.headers.origin || !allowed.includes(req.headers.origin)) {
        res.status(403).json({ message: "Request origin is not allowed" });
        return;
      }
      if (req.path.startsWith("/v1/auth/")) {
        const key = req.ip || "unknown";
        const now = Date.now();
        const entry = requestWindows.get(key);
        if (!entry || now - entry.start > 60000)
          requestWindows.set(key, { start: now, count: 1 });
        else {
          entry.count++;
          if (entry.count > 30) {
            res
              .status(429)
              .json({ message: "Too many requests. Try again in a minute" });
            return;
          }
        }
      }
    }
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, item] of requestWindows)
      if (now - item.start > 60000) requestWindows.delete(key);
  }, 60000);
  cleanup.unref();
  await app.listen(Number(process.env.API_PORT || 3001), "127.0.0.1");
  Logger.log("Wholesale API ready", "Bootstrap");
}
bootstrap().catch((error) => {
  Logger.error(
    error instanceof Error ? error.message : String(error),
    "Bootstrap",
  );
  process.exit(1);
});
