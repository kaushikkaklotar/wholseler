import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, Injectable, Module, NotFoundException, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { phoneSchema, type SessionUser } from "@wholesale/shared";
import { AllowRoles, AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { Database, audit } from "./database";
import { parse } from "./validation";
const memberSchema = z.object({ name: z.string().trim().min(2).max(80), phone: phoneSchema, active: z.boolean().default(true) }).strict();
@Injectable()
export class PlatformTeamService {
  constructor(@Inject(Database) private readonly db: Database) {}
  private admin(actor: SessionUser) {
    if (actor.role !== "PLATFORM_ADMIN") throw new ForbiddenException("Only platform administrators can manage Operations members");
  }
  async list(actor: SessionUser) {
    this.admin(actor);
    const users = await this.db.user.findMany({ where: { role: "PLATFORM_OPERATIONS" }, select: {
      id: true, name: true, phone: true, disabled: true, createdAt: true,
      _count: { select: { assignedTasks: { where: { status: { not: "DONE" } } } } },
    }, orderBy: [{ disabled: "asc" }, { name: "asc" }] });
    return users.map(({ _count, ...user }) => ({ ...user, openTasks: _count.assignedTasks }));
  }
  async save(actor: SessionUser, id: string | null, body: unknown) {
    this.admin(actor);
    const input = parse(memberSchema, body);
    return this.db.serial(async tx => {
      const existing = id ? await tx.user.findFirst({ where: { id, role: "PLATFORM_OPERATIONS" } }) : null;
      if (id && !existing) throw new NotFoundException("Operations member not found");
      const taken = await tx.user.findUnique({ where: { phone: input.phone } });
      if (taken && taken.id !== existing?.id) throw new BadRequestException("This mobile number already belongs to another account. Use a different number.");
      const data = { name: input.name, phone: input.phone, disabled: !input.active };
      const member = existing ? await tx.user.update({ where: { id: existing.id }, data })
        : await tx.user.create({ data: { ...data, role: "PLATFORM_OPERATIONS" } });
      if (existing && (!input.active || existing.phone !== input.phone)) await tx.session.deleteMany({ where: { userId: existing.id } });
      await audit(tx, actor.id, null, existing ? "PLATFORM_MEMBER_UPDATED" : "PLATFORM_MEMBER_CREATED", member.id, `${member.name} · Operations · ${input.active ? "active" : "disabled"}${existing && existing.phone !== input.phone ? " · login mobile changed" : ""}`);
      return { id: member.id, name: member.name, phone: member.phone, disabled: member.disabled };
    });
  }
}
@Controller("v1/platform/team")
@UseGuards(SessionGuard)
@AllowRoles("PLATFORM_ADMIN")
class PlatformTeamController {
  constructor(@Inject(PlatformTeamService) private readonly service: PlatformTeamService) {}
  @Get() list(@Req() req: AuthRequest) { return this.service.list(req.actor); }
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.save(req.actor, null, body); }
  @Patch(":id") update(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) { return this.service.save(req.actor, id, body); }
}
@Module({ imports: [AuthModule], providers: [PlatformTeamService], controllers: [PlatformTeamController] })
export class PlatformTeamModule {}
