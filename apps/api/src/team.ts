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
import {
  businessSchema,
  staffSchema,
  type SessionUser,
} from "@wholesale/shared";
import { Ability, AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { Database, audit } from "./database";
import { parse } from "./validation";
import { activeBusiness } from "./business-policy";
@Injectable()
export class TeamService {
  constructor(@Inject(Database) private readonly db: Database) {}
  async list(actor: SessionUser) {
    const [staff, business] = await Promise.all([
      this.db.staff.findMany({
        where: { businessId: actor.businessId! },
        include: { user: { select: { name: true, phone: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.db.business.findUniqueOrThrow({
        where: { id: actor.businessId! },
        include: { plan: true },
      }),
    ]);
    return {
      staff,
      activeCount: staff.filter((s) => s.active).length,
      plan: business.plan,
    };
  }
  async save(actor: SessionUser, id: string | null, body: unknown) {
    const input = parse(staffSchema, body);
    if (
      actor.role !== "WHOLESALER_OWNER" &&
      input.permissions.some(
        (p) =>
          !actor.permissions.includes(p as (typeof actor.permissions)[number]),
      )
    )
      throw new BadRequestException(
        "You can only grant permissions that your own account has",
      );
    return this.db.serial(async (tx) => {
      const business = await tx.business.update({
        where: { id: actor.businessId! },
        data: { revision: { increment: 1 } },
        include: { plan: true },
      });
      const existing = id
        ? await tx.staff.findFirst({
            where: { id, businessId: business.id },
            include: { user: true },
          })
        : null;
      if (id && !existing) throw new NotFoundException("Team member not found");
      if (existing && input.phone !== existing.user.phone)
        throw new BadRequestException(
          "Disable this account and invite a new member to change the login mobile number",
        );
      if (input.active && !existing?.active) {
        activeBusiness(business);
        const count = await tx.staff.count({
          where: { businessId: business.id, active: true },
        });
        if (count >= business.plan.staffLimit)
          throw new BadRequestException(
            `${business.plan.name} allows ${business.plan.staffLimit} active staff accounts. Disable an account or upgrade the plan`,
          );
      }
      let staff;
      if (existing) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { name: input.name },
        });
        staff = await tx.staff.update({
          where: { id: existing.id },
          data: {
            designation: input.designation,
            permissions: [...new Set(input.permissions)],
            active: input.active,
          },
        });
        if (!input.active)
          await tx.session.deleteMany({ where: { userId: existing.userId } });
      } else {
        let user = await tx.user.findUnique({
          where: { phone: input.phone },
          include: { staff: true },
        });
        if (user && (user.role !== "WHOLESALER_STAFF" || user.staff))
          throw new BadRequestException(
            "This mobile number is already registered with another account",
          );
        if (!user)
          user = await tx.user.create({
            data: {
              name: input.name,
              phone: input.phone,
              role: "WHOLESALER_STAFF",
            },
            include: { staff: true },
          });
        staff = await tx.staff.create({
          data: {
            businessId: business.id,
            userId: user.id,
            designation: input.designation,
            permissions: [...new Set(input.permissions)],
            active: input.active,
          },
        });
      }
      await audit(
        tx,
        actor.id,
        business.id,
        existing ? "STAFF_UPDATED" : "STAFF_INVITED",
        staff.id,
        `${input.name} · ${input.designation} · ${input.active ? "active" : "disabled"}`,
      );
      return staff;
    });
  }
  async settings(actor: SessionUser) {
    const business = await this.db.business.findUniqueOrThrow({
      where: { id: actor.businessId! },
      include: {
        plan: true,
        uploads: {
          where: { kind: "KYC" },
          select: { id: true, fileName: true, createdAt: true },
        },
        _count: {
          select: {
            staff: { where: { active: true } },
            products: { where: { moderation: { not: "ARCHIVED" } } },
          },
        },
      },
    });
    const { ownerId: _, ...output } = business;
    return output;
  }
  async saveSettings(actor: SessionUser, body: unknown) {
    const input = parse(businessSchema, body);
    return this.db.serial(async (tx) => {
      const business = await tx.business.update({
        where: { id: actor.businessId! },
        data: { ...input, verificationStatus: "PENDING", verificationNote: "" },
      });
      await audit(
        tx,
        actor.id,
        actor.businessId,
        "BUSINESS_UPDATED",
        business.id,
        "Business profile updated and queued for verification",
      );
      return business;
    });
  }
}
@Controller("v1/team")
@UseGuards(SessionGuard)
export class TeamController {
  constructor(@Inject(TeamService) private readonly service: TeamService) {}
  @Get() @Ability("STAFF", "VIEW") list(@Req() req: AuthRequest) {
    return this.service.list(req.actor);
  }
  @Post() @Ability("STAFF", "CREATE") create(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.save(req.actor, null, body);
  }
  @Patch(":id") @Ability("STAFF", "EDIT") update(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.save(req.actor, id, body);
  }
}
@Controller("v1/settings")
@UseGuards(SessionGuard)
export class SettingsController {
  constructor(@Inject(TeamService) private readonly service: TeamService) {}
  @Get() @Ability("SETTINGS", "VIEW") get(@Req() req: AuthRequest) {
    return this.service.settings(req.actor);
  }
  @Patch() @Ability("SETTINGS", "EDIT") patch(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.saveSettings(req.actor, body);
  }
}
@Module({
  imports: [AuthModule],
  providers: [TeamService],
  controllers: [TeamController, SettingsController],
})
export class TeamModule {}
