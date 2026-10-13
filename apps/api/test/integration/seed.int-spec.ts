import { QueryType, SearchMode, UserRole } from "@prisma/client";
import { runSeed, SEED_PROJECT } from "../../prisma/seed";
import { PrismaService } from "../../src/database/prisma.service";
import { resetDb } from "../helpers/app";

describe("idempotent seed (T-008)", () => {
  const prisma = new PrismaService();

  beforeEach(async () => resetDb(prisma));
  afterAll(async () => {
    await resetDb(prisma);
    await prisma.$disconnect();
  });

  async function counts(projectId: string) {
    return {
      projects: await prisma.monitoringProject.count({ where: { slug: SEED_PROJECT.slug } }),
      queries: await prisma.listeningQuery.count({ where: { projectId, deletedAt: null } }),
      admins: await prisma.projectMember.count({ where: { projectId, role: UserRole.admin } }),
      integrations: await prisma.integrationConnection.count({ where: { projectId, status: "disconnected" } }),
    };
  }

  it("TC-PROJ-002 / BR-006: running twice yields 1 project, 4 queries, 1 admin, 1 integration", async () => {
    const first = await runSeed(prisma, { adminEmail: "admin@example.com" });
    const second = await runSeed(prisma, { adminEmail: "admin@example.com" });
    expect(second.projectId).toBe(first.projectId);
    expect(second.adminUserId).toBe(first.adminUserId);
    expect(await counts(first.projectId)).toEqual({ projects: 1, queries: 4, admins: 1, integrations: 1 });
  });

  it("TC-PROJ-001: project name and timezone; re-run keeps admin edits", async () => {
    const { projectId } = await runSeed(prisma);
    const p = await prisma.monitoringProject.findUniqueOrThrow({ where: { id: projectId } });
    expect(p.name).toBe(SEED_PROJECT.name);
    expect(p.timezone).toBe("Asia/Ho_Chi_Minh");
    await prisma.monitoringProject.update({ where: { id: projectId }, data: { name: "Edited" } });
    await runSeed(prisma);
    expect((await prisma.monitoringProject.findUniqueOrThrow({ where: { id: projectId } })).name).toBe("Edited");
  });

  it("TC-LQ-001 / BR-004 / BR-005: 4 enabled queries without '#', correct search mode", async () => {
    const { projectId } = await runSeed(prisma);
    const qs = await prisma.listeningQuery.findMany({ where: { projectId } });
    expect(qs.every((q) => q.enabled && !q.queryValue.startsWith("#"))).toBe(true);
    const pairs = qs.map((q) => `${q.queryType}:${q.queryValue}:${q.searchMode}`).sort();
    expect(pairs).toEqual(
      [
        `${QueryType.keyword}:1zone:${SearchMode.KEYWORD}`,
        `${QueryType.keyword}:eventista:${SearchMode.KEYWORD}`,
        `${QueryType.topic_tag}:1zone:${SearchMode.TAG}`,
        `${QueryType.topic_tag}:eventista:${SearchMode.TAG}`,
      ].sort(),
    );
  });

  it("TC-AUTH-017 / FR-019: admin email normalized; role forced back to admin on re-run", async () => {
    const { projectId, adminUserId } = await runSeed(prisma, { adminEmail: "  Admin@Example.COM " });
    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { id: adminUserId } });
    expect(profile.email).toBe("admin@example.com");
    await prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId: profile.id } },
      data: { role: UserRole.viewer },
    });
    await runSeed(prisma, { adminEmail: "admin@example.com" });
    const m = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId, userId: profile.id } },
    });
    expect(m.role).toBe(UserRole.admin);
  });

  it("without adminEmail: no membership, no throw", async () => {
    const res = await runSeed(prisma);
    expect(res.adminUserId).toBeUndefined();
    expect(await prisma.projectMember.count({ where: { projectId: res.projectId } })).toBe(0);
  });

  it("BR-006: '_' and '%' are literal, not wildcards; re-run stays idempotent", async () => {
    // Order matters: ILIKE puts the wildcard in the searched value, so the old check matched
    // `a_b` against an existing `axb` (and `50%` against `50abc`) and skipped them.
    const queries = ["axb", "a_b", "50abc", "50%"].map((v) => ({
      displayName: v,
      queryValue: v,
      queryType: QueryType.keyword,
    }));
    const { projectId } = await runSeed(prisma, { queries });
    const values = async () =>
      (await prisma.listeningQuery.findMany({ where: { projectId, deletedAt: null } })).map((q) => q.queryValue).sort();
    expect(await values()).toEqual(["50%", "50abc", "a_b", "axb"]);
    await runSeed(prisma, { queries });
    expect(await values()).toEqual(["50%", "50abc", "a_b", "axb"]);
  });

  it("BR-006: duplicate match is case-insensitive", async () => {
    const mk = (v: string) => ({ displayName: v, queryValue: v, queryType: QueryType.keyword });
    const { projectId } = await runSeed(prisma, { queries: [mk("a_b"), mk("A_B")] });
    expect(await prisma.listeningQuery.count({ where: { projectId, deletedAt: null } })).toBe(1);
  });
});
