// Idempotent seed — docs/02-architecture/04-data-model.md §6, FR-019/FR-030/FR-050.
import { Prisma, PrismaClient, QueryType, UserRole } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import { findActiveQueryDuplicate } from "../src/common/queries/find-active-query-duplicate";
import { normalizeQuery } from "../src/common/queries/normalize-query";

export const SEED_PROJECT = {
  slug: "1zone-eventista",
  name: "1Zone / Eventista Social Listening",
  timezone: "Asia/Ho_Chi_Minh",
};
export const SEED_QUERIES: { displayName: string; queryValue: string; queryType: QueryType }[] = [
  { displayName: "1zone", queryValue: "1zone", queryType: QueryType.keyword },
  // Raw value keeps '#' on purpose: normalizeQuery strips it (BR-004).
  { displayName: "#1zone", queryValue: "#1zone", queryType: QueryType.topic_tag },
  { displayName: "eventista", queryValue: "eventista", queryType: QueryType.keyword },
  { displayName: "#eventista", queryValue: "eventista", queryType: QueryType.topic_tag },
];

export async function runSeed(
  prisma: PrismaClient,
  opts: { adminEmail?: string; log?: (m: string) => void; queries?: typeof SEED_QUERIES } = {},
): Promise<{ projectId: string; adminUserId?: string }> {
  const log = opts.log ?? (() => undefined);

  // update: {} — re-running never overwrites admin-edited name/timezone/isActive/settings.
  const project = await prisma.monitoringProject.upsert({
    where: { slug: SEED_PROJECT.slug },
    update: {},
    create: { id: uuidv7(), ...SEED_PROJECT, settings: { allowAnalystReanalyze: true, allowViewerExport: false } },
  });
  log(`project ${project.slug} (${project.id})`);

  for (const q of opts.queries ?? SEED_QUERIES) {
    const { queryValue, searchMode } = normalizeQuery(q); // BR-004, BR-005 — before lookup and create
    // BR-006: exact lower() = lower() like the partial unique index — not ILIKE, so '_'/'%' stay literal.
    const existingId = await findActiveQueryDuplicate(prisma, {
      projectId: project.id,
      queryType: q.queryType,
      queryValue,
    });
    if (existingId) {
      log(`query exists: ${q.queryType} ${queryValue}`);
      continue;
    }
    try {
      await prisma.listeningQuery.create({
        data: {
          id: uuidv7(),
          projectId: project.id,
          displayName: q.displayName,
          queryValue,
          queryType: q.queryType,
          searchMode,
          enabled: true,
          nextRunAt: new Date(),
        },
      });
      log(`query created: ${q.queryType} ${queryValue}`);
    } catch (e) {
      // BR-006: concurrent seed hit listening_queries_active_unique → treat as existing.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        log(`query exists: ${q.queryType} ${queryValue}`);
        continue;
      }
      throw e;
    }
  }

  await prisma.integrationConnection.upsert({
    where: { projectId_platform: { projectId: project.id, platform: "threads" } },
    update: {},
    create: { id: uuidv7(), projectId: project.id, platform: "threads", status: "disconnected" },
  });

  const adminEmail = opts.adminEmail?.trim().toLowerCase();
  if (!adminEmail) {
    log("SEED_ADMIN_EMAIL not set — no admin membership seeded.");
    return { projectId: project.id };
  }
  // Reuse an existing profile (e.g. already logged in, id = auth id); otherwise a placeholder
  // re-keyed to auth.users.id on first login by UserProfilesService (FR-017/FR-033).
  const profile =
    (await prisma.userProfile.findUnique({ where: { email: adminEmail } })) ??
    (await prisma.userProfile.create({ data: { id: uuidv7(), email: adminEmail, displayName: "Admin" } }));
  // FR-019: the seeded admin is always forced back to admin on re-run.
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: profile.id } },
    update: { role: UserRole.admin },
    create: { projectId: project.id, userId: profile.id, role: UserRole.admin, invitedEmail: adminEmail },
  });
  log(`admin membership ensured for ${adminEmail}`);
  return { projectId: project.id, adminUserId: profile.id };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await runSeed(prisma, { adminEmail: process.env.SEED_ADMIN_EMAIL, log: (m) => console.log(m) });
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
