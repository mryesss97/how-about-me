import type { INestApplication, ModuleMetadata } from "@nestjs/common";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { APP_CONFIG, type AppConfig } from "../../src/config/config.module";
import { PrismaService } from "../../src/database/prisma.service";
import { configureApp } from "../../src/main";

export async function createTestApp(
  opts: {
    imports?: NonNullable<ModuleMetadata["imports"]>;
    customize?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
  } = {},
): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const { customize } = opts;
  const builder = Test.createTestingModule({ imports: [AppModule, ...(opts.imports ?? [])] });
  const moduleRef = await (customize ? customize(builder) : builder).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, app.get<AppConfig>(APP_CONFIG));
  await app.init();
  // #189: listen once on the exact address supertest dials. Otherwise supertest calls listen(0) per request
  // on `::`, and on macOS that ephemeral port can collide with another process bound to 127.0.0.1:<port>,
  // so the request lands elsewhere (30 s timeout / socket hang up). app.close() closes this server.
  await app.listen(0, "127.0.0.1");
  return { app, prisma: app.get(PrismaService) };
}

/** Truncates business tables between tests (order respects FKs via CASCADE). */
export async function resetDb(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE audit_logs, analysis_settings, analysis_overrides, analysis_phrases, analysis_topics, analysis_intents, post_analyses, analysis_runs, post_query_matches, social_posts, sync_jobs, collector_state, integration_secrets, integration_connections, listening_queries, project_members, user_profiles, monitoring_projects RESTART IDENTITY CASCADE`,
  );
}
