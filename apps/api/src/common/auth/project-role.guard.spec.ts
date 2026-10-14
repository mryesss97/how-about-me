import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@how-about-me/contracts";
import type { PrismaService } from "../../database/prisma.service";
import { AppError } from "../errors/app.error";
import type { AuthedRequest } from "./current-user.decorator";
import { ProjectRoleGuard } from "./project-role.guard";
import {
  AllowRoleWhenSetting,
  PROJECT_SETTING_GATE_KEY,
  type ProjectSettingGate,
} from "./project-setting-gate.decorator";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { ROLES_KEY } from "./roles.decorator";

const PID = "11111111-1111-4111-8111-111111111111";
const user = { id: "u1", email: "a@x.com", displayName: null };

function setup(opts: {
  isPublic?: boolean;
  roles?: UserRole[];
  gates?: ProjectSettingGate[];
  member?: { role: UserRole; settings: unknown } | null;
}) {
  const meta: Record<string, unknown> = {
    [IS_PUBLIC_KEY]: opts.isPublic ?? false,
    [ROLES_KEY]: opts.roles,
    [PROJECT_SETTING_GATE_KEY]: opts.gates,
  };
  const reflector = { getAllAndOverride: jest.fn((key: string) => meta[key]) } as unknown as Reflector;
  const m = opts.member;
  const findUnique = jest.fn().mockResolvedValue(m ? { role: m.role, project: { settings: m.settings } } : null);
  const guard = new ProjectRoleGuard(reflector, { projectMember: { findUnique } } as unknown as PrismaService);
  const run = (req: AuthedRequest) =>
    guard
      .canActivate({
        getHandler: () => null,
        getClass: () => null,
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext)
      .catch((e: unknown) => e);
  return { run, findUnique };
}

const req = (projectId?: string): AuthedRequest => ({
  headers: {},
  params: projectId ? { projectId } : {},
  user,
});
const code = (r: unknown) => (r instanceof AppError ? r.code : r);

describe("ProjectRoleGuard (FR-014, FR-015, FR-016)", () => {
  it("skips @Public() routes", async () => {
    const { run, findUnique } = setup({ isPublic: true });
    expect(await run(req(PID))).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("passes routes without :projectId", async () => {
    const { run, findUnique } = setup({});
    expect(await run(req())).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("invalid projectId → VALIDATION_ERROR", async () => {
    expect(code(await setup({}).run(req("nope")))).toBe("VALIDATION_ERROR");
  });

  it("TC-AUTH-011: non-member → FORBIDDEN_PROJECT", async () => {
    expect(code(await setup({ member: null, roles: ["admin"] }).run(req(PID)))).toBe("FORBIDDEN_PROJECT");
  });

  it("TC-AUTH-009: role not in @Roles → FORBIDDEN_ROLE", async () => {
    expect(code(await setup({ roles: ["admin"], member: { role: "viewer", settings: {} } }).run(req(PID)))).toBe(
      "FORBIDDEN_ROLE",
    );
  });

  it("no @Roles → any member passes and req.project carries role + parsed settings", async () => {
    const r = req(PID);
    expect(await setup({ member: { role: "viewer", settings: {} } }).run(r)).toBe(true);
    expect(r.project).toEqual({
      projectId: PID,
      role: "viewer",
      settings: { allowAnalystReanalyze: true, allowViewerExport: false, phraseMinMentions: 2 },
    });
  });

  const reanalyze: ProjectSettingGate[] = [{ role: "analyst", setting: "allowAnalystReanalyze" }];
  const exportGate: ProjectSettingGate[] = [{ role: "viewer", setting: "allowViewerExport" }];

  it.each([
    ["TC-AUTH-018 setting false", reanalyze, "analyst", { allowAnalystReanalyze: false }, "FORBIDDEN_ROLE"],
    ["setting true", reanalyze, "analyst", { allowAnalystReanalyze: true }, true],
    ["missing key → default true", reanalyze, "analyst", {}, true],
    ["gate does not apply to admin", reanalyze, "admin", { allowAnalystReanalyze: false }, true],
    ["viewer export default false", exportGate, "viewer", {}, "FORBIDDEN_ROLE"],
    ["viewer export enabled", exportGate, "viewer", { allowViewerExport: true }, true],
    ["garbage settings → defaults (deny export)", exportGate, "viewer", "garbage", "FORBIDDEN_ROLE"],
    ["null settings → defaults", reanalyze, "analyst", null, true],
    [
      "#251: malformed phraseMinMentions does not affect gates",
      exportGate,
      "viewer",
      { allowViewerExport: true, phraseMinMentions: "x" },
      true,
    ],
    ["wrong-typed value → defaults", exportGate, "viewer", { allowViewerExport: "yes" }, "FORBIDDEN_ROLE"],
    [
      "one bad key keeps the other valid key",
      reanalyze,
      "analyst",
      { allowAnalystReanalyze: false, allowViewerExport: "yes" },
      "FORBIDDEN_ROLE",
    ],
  ] as const)("gate: %s", async (_name, gates, role, settings, expected) => {
    const { run } = setup({
      roles: ["admin", "analyst", "viewer"],
      gates: [...gates],
      member: { role, settings },
    });
    expect(code(await run(req(PID)))).toBe(expected);
  });
});

describe("AllowRoleWhenSetting", () => {
  it("stacked decorators accumulate gates", () => {
    class Ctl {
      @AllowRoleWhenSetting("analyst", "allowAnalystReanalyze")
      @AllowRoleWhenSetting("viewer", "allowViewerExport")
      handler() {}
    }
    const gates = new Reflector().get<ProjectSettingGate[]>(PROJECT_SETTING_GATE_KEY, Ctl.prototype.handler);
    expect(gates).toEqual(
      expect.arrayContaining([
        { role: "analyst", setting: "allowAnalystReanalyze" },
        { role: "viewer", setting: "allowViewerExport" },
      ]),
    );
    expect(gates).toHaveLength(2);
  });
});
