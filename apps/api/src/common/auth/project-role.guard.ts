import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type ProjectSettings, ProjectSettingsSchema, type UserRole } from "@how-about-me/contracts";
import { PrismaService } from "../../database/prisma.service";
import { AppError } from "../errors/app.error";
import type { AuthedRequest } from "./current-user.decorator";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { PROJECT_SETTING_GATE_KEY, type ProjectSettingGate } from "./project-setting-gate.decorator";
import { ROLES_KEY } from "./roles.decorator";

/**
 * Global guard for `/projects/:projectId/**`: resolves membership → `req.project`, enforces `@Roles()` and
 * `@AllowRoleWhenSetting()` project-setting gates (FR-014…FR-016, docs/01-product/02-personas-rbac.md §3–4).
 * Non-members always get FORBIDDEN_PROJECT first, whether or not the project exists (TC-AUTH-011).
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
      // Settings ride along in the same query so gating stays one query per request.
      select: { role: true, project: { select: { settings: true } } },
    });
    if (!membership) throw new AppError("FORBIDDEN_PROJECT", "You are not a member of this project");
    const role = membership.role as UserRole;
    const settings = parseSettings(membership.project.settings);
    req.project = { projectId, role, settings };

    const allowed = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (allowed?.length && !allowed.includes(role))
      throw new AppError("FORBIDDEN_ROLE", `Requires role: ${allowed.join(" | ")}`);

    const gates = this.reflector.getAllAndOverride<ProjectSettingGate[] | undefined>(PROJECT_SETTING_GATE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    for (const gate of gates ?? []) {
      if (gate.role === role && settings[gate.setting] !== true)
        throw new AppError("FORBIDDEN_ROLE", `Disabled by project setting ${gate.setting}`);
    }
    return true;
  }
}

/**
 * Malformed settings never cause a 500: each key that is missing or has the wrong type falls back to its own schema
 * default (deny-safe for allowViewerExport); valid keys are kept, so one bad key does not reset the others.
 */
function parseSettings(raw: unknown): ProjectSettings {
  const parsed = ProjectSettingsSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  const obj = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const settings = ProjectSettingsSchema.parse({});
  for (const key of Object.keys(settings) as (keyof ProjectSettings)[]) {
    const value = obj[key];
    if (typeof value === "boolean") settings[key] = value;
  }
  return settings;
}
