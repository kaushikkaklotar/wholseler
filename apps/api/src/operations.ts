import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import type { SessionUser } from "@wholesale/shared";
import { AllowRoles, AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { Database, audit } from "./database";
import { parse } from "./validation";
const stages = [
  "NEW",
  "PROFILE",
  "DOCUMENTS",
  "CATALOG",
  "TRAINING",
  "READY",
] as const;
const taskSchema = z.object({
  title: z.string().trim().min(3).max(150),
  category: z.enum(["PROFILE", "DOCUMENTS", "CATALOG", "STOCK", "TRAINING"]),
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).default("TODO"),
  assigneeId: z.string().nullable().default(null),
  dueAt: z.string().datetime().nullable().default(null),
  note: z.string().trim().max(1000).default(""),
});
@Injectable()
export class OperationsService {
  constructor(@Inject(Database) private readonly db: Database) {}
  async detail(id: string) {
    const business = await this.db.business.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        onboardingStage: true,
        verificationStatus: true,
      },
    });
    if (!business) throw new NotFoundException("Business not found");
    const [tasks, team] = await Promise.all([
      this.db.onboardingTask.findMany({
        where: { businessId: id },
        include: { assignee: { select: { name: true } } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      }),
      this.db.user.findMany({
        where: {
          role: { in: ["PLATFORM_ADMIN", "PLATFORM_OPERATIONS"] },
          disabled: false,
        },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { business, tasks, team, stages };
  }
  async stage(actor: SessionUser, id: string, body: unknown) {
    const input = parse(z.object({ stage: z.enum(stages) }), body);
    return this.db.serial(async (tx) => {
      const business = await tx.business.findUniqueOrThrow({
        where: { id },
        include: {
          _count: {
            select: {
              products: {
                where: {
                  moderation: "APPROVED",
                  images: { some: {} },
                  variants: { some: { archived: false } },
                },
              },
              onboardingTasks: { where: { status: { not: "DONE" } } },
            },
          },
        },
      });
      if (
        input.stage === "READY" &&
        (business.verificationStatus !== "VERIFIED" ||
          !business._count.products ||
          business._count.onboardingTasks)
      )
        throw new BadRequestException(
          "Ready requires business approval, at least one approved product with images, and all onboarding tasks completed",
        );
      await tx.business.update({
        where: { id },
        data: { onboardingStage: input.stage },
      });
      await audit(tx, actor.id, id, "ONBOARDING_STAGE", id, input.stage);
      return { ok: true };
    });
  }
  async task(
    actor: SessionUser,
    businessId: string,
    taskId: string | null,
    body: unknown,
  ) {
    const input = parse(taskSchema, body);
    return this.db.serial(async (tx) => {
      const business = await tx.business.findUnique({
        where: { id: businessId },
      });
      if (!business) throw new NotFoundException("Business not found");
      if (
        input.assigneeId &&
        !(await tx.user.findFirst({
          where: {
            id: input.assigneeId,
            disabled: false,
            role: { in: ["PLATFORM_ADMIN", "PLATFORM_OPERATIONS"] },
          },
        }))
      )
        throw new BadRequestException("Assign an active platform team member");
      if (
        taskId &&
        !(await tx.onboardingTask.findFirst({
          where: { id: taskId, businessId },
        }))
      )
        throw new NotFoundException("Task not found");
      const data = {
        ...input,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      };
      const task = taskId
        ? await tx.onboardingTask.update({ where: { id: taskId }, data })
        : await tx.onboardingTask.create({ data: { ...data, businessId } });
      if (business.onboardingStage === "READY" && input.status !== "DONE")
        await tx.business.update({
          where: { id: businessId },
          data: { onboardingStage: "CATALOG" },
        });
      await audit(
        tx,
        actor.id,
        businessId,
        taskId ? "ONBOARDING_TASK_UPDATED" : "ONBOARDING_TASK_CREATED",
        task.id,
        `${input.title} · ${input.status}`,
      );
      return task;
    });
  }
}
@Controller("v1/platform/businesses/:businessId/operations")
@UseGuards(SessionGuard)
@AllowRoles("PLATFORM_ADMIN", "PLATFORM_OPERATIONS")
export class OperationsController {
  constructor(
    @Inject(OperationsService) private readonly service: OperationsService,
  ) {}
  @Get() detail(@Param("businessId") id: string) {
    return this.service.detail(id);
  }
  @Patch("stage") stage(
    @Req() req: AuthRequest,
    @Param("businessId") id: string,
    @Body() body: unknown,
  ) {
    return this.service.stage(req.actor, id, body);
  }
  @Post("tasks") create(
    @Req() req: AuthRequest,
    @Param("businessId") id: string,
    @Body() body: unknown,
  ) {
    return this.service.task(req.actor, id, null, body);
  }
  @Patch("tasks/:taskId") update(
    @Req() req: AuthRequest,
    @Param("businessId") id: string,
    @Param("taskId") taskId: string,
    @Body() body: unknown,
  ) {
    return this.service.task(req.actor, id, taskId, body);
  }
}
@Module({
  imports: [AuthModule],
  providers: [OperationsService],
  controllers: [OperationsController],
})
export class OperationsModule {}
