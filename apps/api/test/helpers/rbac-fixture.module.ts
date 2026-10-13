import { Controller, Get, HttpCode, Module, Patch, Post } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { AllowRoleWhenSetting } from "../../src/common/auth/project-setting-gate.decorator";
import { Roles } from "../../src/common/auth/roles.decorator";

/** Path segment marking test-only routes; excluded from permission-matrix coverage. */
export const RBAC_FIXTURE_SEGMENT = "__rbac";

/**
 * Test-only routes exercising ProjectRoleGuard while the real mutating routes are still `planned` (T-031).
 * Never imported by AppModule.
 */
@Controller(`projects/:projectId/${RBAC_FIXTURE_SEGMENT}`)
class RbacFixtureController {
  @Get("read")
  read() {
    return { ok: true };
  }

  @Post("admin-only")
  @Roles("admin")
  @HttpCode(202)
  adminOnlyPost() {
    return { ok: true };
  }

  @Patch("admin-only")
  @Roles("admin")
  @HttpCode(202)
  adminOnlyPatch() {
    return { ok: true };
  }

  @Post("reanalyze")
  @Roles("admin", "analyst")
  @AllowRoleWhenSetting("analyst", "allowAnalystReanalyze")
  @HttpCode(202)
  reanalyze() {
    return { ok: true };
  }

  @Post("export")
  @Roles("admin", "analyst", "viewer")
  @AllowRoleWhenSetting("viewer", "allowViewerExport")
  @HttpCode(202)
  exportCsv() {
    return { ok: true };
  }
}

@Module({ imports: [DiscoveryModule], controllers: [RbacFixtureController] })
export class RbacFixtureModule {}
