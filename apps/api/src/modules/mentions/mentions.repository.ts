import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export type MentionForReanalyze = { id: string; projectId: string; contentHash: string; revision: number };

/** Data access for mentions (social_posts) — FR-115. */
@Injectable()
export class MentionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Scoped to the project so a post of another project is indistinguishable from a missing one. */
  findInProject(tx: Prisma.TransactionClient, projectId: string, id: string): Promise<MentionForReanalyze | null> {
    return tx.socialPost.findFirst({
      where: { id, projectId },
      select: { id: true, projectId: true, contentHash: true, revision: true },
    });
  }

  /** BR-024 / FR-115: any open run of the post (any hash or version) counts as "already pending". */
  async hasOpenRun(tx: Prisma.TransactionClient, postId: string): Promise<boolean> {
    const n = await tx.analysisRun.count({ where: { postId, status: { in: ["pending", "processing"] } } });
    return n > 0;
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
