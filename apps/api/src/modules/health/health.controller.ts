import { Controller, Get, Inject } from "@nestjs/common";
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from "@nestjs/terminus";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/auth/public.decorator";
import { PrismaService } from "../../database/prisma.service";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";

/** FR-172: `/health/live` (process) and `/health/ready` (DB required; providers informational). */
@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  @Public()
  @Get("live")
  live() {
    return { status: "ok", version: this.cfg.APP_VERSION, role: this.cfg.APP_ROLE };
  }

  @Public()
  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([() => this.prismaIndicator.pingCheck("database", this.prisma, { timeout: 3000 })]);
  }
}
