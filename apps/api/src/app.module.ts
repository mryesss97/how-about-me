import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AuthCommonModule } from "./common/auth/auth-common.module";
import { HttpExceptionFilter } from "./common/errors/http-exception.filter";
import { buildLoggerParams } from "./common/logging/logger.config";
import { APP_CONFIG, AppConfigModule, type AppConfig } from "./config/config.module";
import { PrismaModule } from "./database/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { ProjectsModule } from "./modules/projects/projects.module";

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({ inject: [APP_CONFIG], useFactory: (cfg: AppConfig) => buildLoggerParams(cfg) }),
    ThrottlerModule.forRoot([{ name: "global", ttl: 60_000, limit: 300 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthCommonModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
    // M2+: IntegrationsModule, ListeningQueriesModule, CollectorModule, SyncJobsModule, AuditModule, SystemStatusModule
    // M3+: AnalysisModule · M4+: MentionsModule, AnalyticsModule · M6: ReviewsModule, ExportModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
