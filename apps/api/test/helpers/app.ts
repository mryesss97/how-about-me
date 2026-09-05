import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/database/prisma.service";

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix("api/v1", { exclude: ["health/live", "health/ready", "metrics"] });
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** Truncates business tables between tests (order respects FKs via CASCADE). */
export async function resetDb(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE audit_logs, analysis_overrides, analysis_topics, analysis_intents, post_analyses, analysis_runs, post_query_matches, social_posts, sync_jobs, collector_state, integration_secrets, integration_connections, listening_queries, project_members, user_profiles, monitoring_projects RESTART IDENTITY CASCADE`,
  );
}
