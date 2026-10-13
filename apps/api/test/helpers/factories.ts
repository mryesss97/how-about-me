import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../../src/database/prisma.service";

/**
 * Test data factories (T-014). Rows are written straight through Prisma; ids are app-generated UUIDs.
 * Unique columns (slug, email, platformPostId) combine a module counter with a UUID slice so values
 * stay readable in failures and never collide, even across `resetDb()` calls.
 */
let counter = 0;
const seq = () => ++counter;
const short = () => randomUUID().slice(0, 8);

export function createProject(
  prisma: PrismaService,
  overrides: Partial<Prisma.MonitoringProjectUncheckedCreateInput> = {},
) {
  const n = seq();
  return prisma.monitoringProject.create({
    data: {
      id: randomUUID(),
      name: `Project ${n}`,
      slug: `project-${n}-${short()}`,
      timezone: "Asia/Ho_Chi_Minh",
      ...overrides,
    },
  });
}

export function createUser(prisma: PrismaService, overrides: Partial<Prisma.UserProfileUncheckedCreateInput> = {}) {
  const n = seq();
  return prisma.userProfile.create({
    data: { id: randomUUID(), email: `user-${n}-${short()}@example.com`, ...overrides },
  });
}

export function addMember(prisma: PrismaService, data: Prisma.ProjectMemberUncheckedCreateInput) {
  return prisma.projectMember.create({ data });
}

export function createQuery(
  prisma: PrismaService,
  input: { projectId: string } & Partial<Prisma.ListeningQueryUncheckedCreateInput>,
) {
  const n = seq();
  return prisma.listeningQuery.create({
    data: {
      id: randomUUID(),
      displayName: `Query ${n}`,
      queryValue: `keyword-${n}`,
      queryType: "keyword",
      searchMode: "KEYWORD",
      ...input,
    },
  });
}

/** BR-001: posts are unique on (platform, platform_post_id) — the default platformPostId is unique per call. */
export async function createPost(
  prisma: PrismaService,
  input: { projectId: string; queryId?: string } & Partial<Prisma.SocialPostUncheckedCreateInput>,
) {
  const { queryId, ...rest } = input;
  const n = seq();
  const now = new Date();
  const text = rest.text ?? `Post ${n}`;
  const post = await prisma.socialPost.create({
    data: {
      id: randomUUID(),
      platform: "threads",
      platformPostId: `tp-${n}-${short()}`,
      publishedAt: now,
      firstSeenAt: now,
      lastSeenAt: now,
      contentHash: createHash("sha256").update(text).digest("hex"),
      ...rest,
      text,
    },
  });
  if (queryId) {
    await prisma.postQueryMatch.create({
      data: { postId: post.id, queryId, firstMatchedAt: now, lastMatchedAt: now },
    });
  }
  return post;
}
