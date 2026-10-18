import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AuthCommonModule } from "./common/auth/auth-common.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { HttpExceptionFilter } from "./common/errors/http-exception.filter";
import { buildLoggerParams } from "./common/logging/logger.config";
import { APP_CONFIG, AppConfigModule, type AppConfig } from "./config/config.module";
import { PrismaModule } from "./database/prisma.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AnalysisModule } from "./modules/analysis/analysis.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CollectorModule } from "./modules/collector/collector.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { ListeningQueriesModule } from "./modules/listening-queries/listening-queries.module";
import { MentionsModule } from "./modules/mentions/mentions.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { HealthModule } from "./modules/health/health.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { RetentionJobModule } from "./jobs/retention-job.module";
import { SchedulerModule } from "./jobs/scheduler.module";

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({ inject: [APP_CONFIG], useFactory: (cfg: AppConfig) => buildLoggerParams(cfg) }),
    ThrottlerModule.forRoot([{ name: "global", ttl: 60_000, limit: 300 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthCommonModule,
    CryptoModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
    ProvidersModule,
    CollectorModule,
    AnalysisModule,
    SchedulerModule,
    RetentionJobModule,
    AuditModule,
    ListeningQueriesModule,
    MentionsModule,
    ReviewsModule,
    AnalyticsModule,
    IntegrationsModule,
    // M2+: SyncJobsModule, SystemStatusModule
    // M6: T-147 export lives in MentionsModule (route must precede `:mentionId`)
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
