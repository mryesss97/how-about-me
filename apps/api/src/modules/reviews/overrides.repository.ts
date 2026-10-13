import type { OverrideField } from "@how-about-me/contracts";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../database/prisma.service";

/** analysis_overrides row in domain shape (no Prisma types outside this module). */
export type OverrideRow = {
  id: string;
  postId: string;
  field: OverrideField;
  /** Stored as `{ "value": … }` (doc 04 §4.13); null when the post had no AI analysis. */
  previousValue: unknown;
  overrideValue: unknown;
  reason: string | null;
  reviewedBy: string;
  createdAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
};

export type OverrideUser = { id: string; displayName: string | null; email: string };
export type OverrideWithUsers = { row: OverrideRow; users: Map<string, OverrideUser> };

export type NewOverride = {
  id: string;
  postId: string;
  projectId: string;
  analysisId: string | null;
  field: OverrideField;
  previousValue: { value: string | string[] } | null;
  overrideValue: { value: string | string[] };
  reason: string | null;
  reviewedBy: string;
};

/** Transaction handle for callers outside the repository (keeps `@prisma/client` imports here). */
export type Tx = Prisma.TransactionClient;

export type LockedPost = { id: string; currentAnalysisId: string | null };

const LockedPostSchema = z.object({ id: z.string(), current_analysis_id: z.string().nullable() });

const SELECT = {
  id: true,
  postId: true,
  field: true,
  previousValue: true,
  overrideValue: true,
  reason: true,
  reviewedBy: true,
  createdAt: true,
  revokedAt: true,
  revokedBy: true,
} as const;

/** P2002 on analysis_overrides can only come from `analysis_overrides_active_unique` (PK is a random uuid). */
export function isActiveOverrideConflict(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** Data access for analysis overrides — T-142, doc 04 §4.13, doc 07 §10. */
@Injectable()
export class OverridesRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  /**
   * Row-locks the post (scoped to the project → another project's post is a 404) so concurrent create/revoke
   * on the same post run one after another and never trip the active partial unique index.
   */
  async lockPostInProject(tx: Prisma.TransactionClient, projectId: string, postId: string): Promise<LockedPost | null> {
    const rows = await tx.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id::text AS id, current_analysis_id::text AS current_analysis_id FROM social_posts
       WHERE id = ${postId}::uuid AND project_id = ${projectId}::uuid FOR UPDATE`);
    const row = rows[0];
    if (!row) return null;
    const r = LockedPostSchema.parse(row);
    return { id: r.id, currentAnalysisId: r.current_analysis_id };
  }

  /** AI value of `field` in the given analysis (snapshot for `previous_value`); intents/topics by confidence. */
  async aiValue(
    tx: Prisma.TransactionClient,
    analysisId: string,
    field: OverrideField,
  ): Promise<string | string[] | null> {
    if (field === "intents" || field === "topics") {
      const order = [{ confidence: { sort: "desc", nulls: "last" } }, { label: "asc" }] as const;
      const rows =
        field === "intents"
          ? await tx.analysisIntent.findMany({ where: { analysisId }, orderBy: [...order], select: { label: true } })
          : await tx.analysisTopic.findMany({ where: { analysisId }, orderBy: [...order], select: { label: true } });
      return rows.map((r) => r.label);
    }
    const a = await tx.postAnalysis.findUnique({
      where: { id: analysisId },
      select: { relevanceLabel: true, sentimentLabel: true, safetyLevel: true },
    });
    if (!a) return null;
    const v = field === "relevance" ? a.relevanceLabel : field === "sentiment" ? a.sentimentLabel : a.safetyLevel;
    return v == null ? null : String(v);
  }

  async findActive(tx: Prisma.TransactionClient, postId: string, field: OverrideField): Promise<OverrideRow | null> {
    return tx.analysisOverride.findFirst({ where: { postId, field, revokedAt: null }, select: SELECT });
  }

  /** Scoped to the post → an override of another post is indistinguishable from a missing one (404). */
  async findById(tx: Prisma.TransactionClient, postId: string, overrideId: string): Promise<OverrideRow | null> {
    return tx.analysisOverride.findFirst({ where: { id: overrideId, postId }, select: SELECT });
  }

  /** FR-193: revoke keeps the row (history). */
  async revoke(tx: Prisma.TransactionClient, id: string, actorUserId: string, now: Date): Promise<void> {
    await tx.analysisOverride.update({ where: { id }, data: { revokedAt: now, revokedBy: actorUserId } });
  }

  async insert(tx: Prisma.TransactionClient, data: NewOverride): Promise<OverrideRow> {
    return tx.analysisOverride.create({
      data: {
        ...data,
        previousValue: data.previousValue ?? Prisma.DbNull,
      },
      select: SELECT,
    });
  }

  /** User refs for reviewer/revoker ids (no FK to user_profiles → joined here). */
  async usersById(ids: string[], db: Prisma.TransactionClient = this.prisma): Promise<Map<string, OverrideUser>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const users = await db.userProfile.findMany({
      where: { id: { in: unique } },
      select: { id: true, displayName: true, email: true },
    });
    return new Map(users.map((u) => [u.id, u]));
  }

  /** Full override history of a post (active + revoked), newest first — FR-193. */
  async listForPost(postId: string): Promise<OverrideWithUsers[]> {
    const rows = await this.prisma.analysisOverride.findMany({
      where: { postId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: SELECT,
    });
    const users = await this.usersById(
      rows.flatMap((r) => (r.revokedBy ? [r.reviewedBy, r.revokedBy] : [r.reviewedBy])),
    );
    return rows.map((row) => ({ row, users }));
  }
}
