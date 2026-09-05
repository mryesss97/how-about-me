import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@how-about-me/contracts";
import { PrismaService } from "../../database/prisma.service";
import { AppError } from "../errors/app.error";
import type { AuthedRequest } from "./current-user.decorator";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { ROLES_KEY } from "./roles.decorator";

/**
 * Global guard for `/projects/:projectId/**`: resolves membership → `req.project`, enforces `@Roles()` (FR-014…FR-016).
 * Routes without a `projectId` param are unaffected.
 */
@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const projectId = req.params?.["projectId"];
    if (!projectId) return true;
    if (!req.user) throw new AppError("AUTH_MISSING_TOKEN");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId))
      throw new AppError("VALIDATION_ERROR", "Invalid projectId");

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user.id } },
      select: { role: true },
    });
    if (!membership) throw new AppError("FORBIDDEN_PROJECT", "You are not a member of this project");
    req.project = { projectId, role: membership.role as UserRole };

    const allowed = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (allowed?.length && !allowed.includes(membership.role as UserRole))
      throw new AppError("FORBIDDEN_ROLE", `Requires role: ${allowed.join(" | ")}`);
    return true;
  }
}
