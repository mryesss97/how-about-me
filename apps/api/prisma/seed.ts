// Idempotent seed — docs/02-architecture/04-data-model.md §6, FR-019/FR-030/FR-050.
import { PrismaClient, QueryType, SearchMode, UserRole } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";

const prisma = new PrismaClient();

const PROJECT = { slug: "1zone-eventista", name: "1Zone / Eventista Social Listening", timezone: "Asia/Ho_Chi_Minh" };
const QUERIES: { displayName: string; queryValue: string; queryType: QueryType }[] = [
  { displayName: "1zone (keyword)", queryValue: "1zone", queryType: QueryType.keyword },
  { displayName: "#1zone (topic tag)", queryValue: "1zone", queryType: QueryType.topic_tag },
  { displayName: "eventista (keyword)", queryValue: "eventista", queryType: QueryType.keyword },
  { displayName: "#eventista (topic tag)", queryValue: "eventista", queryType: QueryType.topic_tag },
];

async function main() {
  const project = await prisma.monitoringProject.upsert({
    where: { slug: PROJECT.slug },
    update: { name: PROJECT.name, timezone: PROJECT.timezone, isActive: true },
    create: { id: uuidv7(), ...PROJECT, settings: { allowAnalystReanalyze: true, allowViewerExport: false } },
  });
  console.log(`project ${project.slug} (${project.id})`);

  for (const q of QUERIES) {
    const existing = await prisma.listeningQuery.findFirst({
      where: {
        projectId: project.id,
        queryType: q.queryType,
        queryValue: { equals: q.queryValue, mode: "insensitive" },
        deletedAt: null,
      },
    });
    if (existing) {
      console.log(`query exists: ${q.queryType} ${q.queryValue}`);
      continue;
    }
    await prisma.listeningQuery.create({
      data: {
        id: uuidv7(),
        projectId: project.id,
        displayName: q.displayName,
        queryValue: q.queryValue.replace(/^#+/, ""), // BR-004
        queryType: q.queryType,
        searchMode: q.queryType === QueryType.keyword ? SearchMode.KEYWORD : SearchMode.TAG, // BR-005
        enabled: true,
        nextRunAt: new Date(),
      },
    });
    console.log(`query created: ${q.queryType} ${q.queryValue}`);
  }

  await prisma.integrationConnection.upsert({
    where: { projectId_platform: { projectId: project.id, platform: "threads" } },
    update: {},
    create: { id: uuidv7(), projectId: project.id, platform: "threads", status: "disconnected" },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  if (adminEmail) {
    // Placeholder profile keyed by a generated id; reconciled with auth.users.id on first login (email match).
    const profile =
      (await prisma.userProfile.findUnique({ where: { email: adminEmail } })) ??
      (await prisma.userProfile.create({ data: { id: uuidv7(), email: adminEmail, displayName: "Admin" } }));
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: profile.id } },
      update: { role: UserRole.admin },
      create: { projectId: project.id, userId: profile.id, role: UserRole.admin, invitedEmail: adminEmail },
    });
    console.log(`admin membership ensured for ${adminEmail}`);
  } else {
    console.warn("SEED_ADMIN_EMAIL not set — no admin membership seeded.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
