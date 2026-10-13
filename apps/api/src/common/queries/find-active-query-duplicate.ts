import { Prisma, type PrismaClient, type QueryType } from "@prisma/client";
import { z } from "zod";

const IdRowsSchema = z.array(z.object({ id: z.string() }));

/**
 * BR-006 / FR-053: same expression as the partial unique index `listening_queries_active_unique`
 * (lower(query_value), active rows only). Exact `lower() = lower()` — no ILIKE, so `_`/`%` are literal.
 * Shared by ListeningQueriesRepository and prisma/seed.ts (seed runs outside Nest DI).
 */
export async function findActiveQueryDuplicate(
  db: PrismaClient | Prisma.TransactionClient,
  args: { projectId: string; queryType: QueryType; queryValue: string; excludeId?: string },
): Promise<string | null> {
  const exclude = args.excludeId ? Prisma.sql`AND id <> ${args.excludeId}::uuid` : Prisma.empty;
  const rows: unknown = await db.$queryRaw(Prisma.sql`
    SELECT id::text AS id FROM listening_queries
     WHERE project_id = ${args.projectId}::uuid
       AND platform = 'threads'
       AND query_type = ${args.queryType}::query_type
       AND lower(query_value) = lower(${args.queryValue})
       AND deleted_at IS NULL
       ${exclude}
     LIMIT 1`);
  return IdRowsSchema.parse(rows)[0]?.id ?? null;
}
