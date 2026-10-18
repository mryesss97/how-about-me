import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AppError } from "../errors/app.error";
import type { PrismaService } from "../../database/prisma.service";
import { decodeSortCursor, encodeSortCursor } from "./cursor";

/**
 * Keyset pagination on `(created_at DESC, id DESC)` evaluated in SQL (#188).
 * The sort key is read as text with full µs precision so rows inside one millisecond are never skipped.
 */
export const CREATED_DESC_SORT = "created_desc";

/** Deterministic format, independent of session TimeZone/DateStyle: `YYYY-MM-DDTHH:MI:SS.uuuuuuZ`. */
export function utcMicrosKeySql(expr: string): Prisma.Sql {
  // expr is a code whitelist, never user input
  return Prisma.raw(`to_char((${expr}) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`);
}

export const CREATED_AT_KEY_SQL = utcMicrosKeySql("created_at");

export type CreatedAtCursor = { key: string; id: string };
export type CreatedAtTable = "analysis_runs" | "audit_logs" | "listening_queries" | "sync_jobs";

const KEY_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export function encodeCreatedAtCursor(c: CreatedAtCursor): string {
  return encodeSortCursor({ sort: CREATED_DESC_SORT, keys: [c.key], id: c.id });
}

/** Tampered cursor → 400 VALIDATION_ERROR; never lets `::timestamptz`/`::uuid` fail in PG (would be 500). */
export function decodeCreatedAtCursor(raw: string | undefined | null): CreatedAtCursor | null {
  const c = decodeSortCursor(raw, { sort: CREATED_DESC_SORT, arity: 1 });
  if (!c) return null;
  const key = c.keys[0];
  if (!isUtcMicrosKey(key)) throw new AppError("VALIDATION_ERROR", "Invalid cursor", { path: "cursor" });
  return { key, id: c.id };
}

/** True for a real UTC instant in the µs key format produced by `utcMicrosKeySql` (#188, #195). */
export function isUtcMicrosKey(key: unknown): key is string {
  return typeof key === "string" && KEY_RE.test(key) && isRealDate(key);
}

function isRealDate(key: string): boolean {
  const d = new Date(`${key.slice(0, 23)}Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 19) === key.slice(0, 19);
}

export function createdAtKeysetSql(cursor: CreatedAtCursor | null): Prisma.Sql {
  if (!cursor) return Prisma.empty;
  // #188: full µs precision; same order as ORDER BY created_at DESC, id DESC
  return Prisma.sql`AND (created_at, id) < (${cursor.key}::timestamptz, ${cursor.id}::uuid)`;
}

type Db = PrismaService | Prisma.TransactionClient;
const KeyRows = z.array(z.object({ id: z.string(), key: z.string() }));
const CountRows = z.array(z.object({ n: z.number().int() }));

/** Returns up to `limit + 1` page keys; `table` is a literal whitelist, never user input. */
export async function pageKeysByCreatedAt(
  db: Db,
  table: CreatedAtTable,
  where: Prisma.Sql,
  cursor: CreatedAtCursor | null,
  limit: number,
): Promise<CreatedAtCursor[]> {
  const rows: unknown = await db.$queryRaw(
    Prisma.sql`SELECT id::text AS id, ${CREATED_AT_KEY_SQL} AS key FROM ${Prisma.raw(table)}
      WHERE ${where} ${createdAtKeysetSql(cursor)}
      ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}`,
  );
  return KeyRows.parse(rows);
}

export async function countWhere(db: Db, table: CreatedAtTable, where: Prisma.Sql): Promise<number> {
  const rows: unknown = await db.$queryRaw(
    Prisma.sql`SELECT count(*)::int AS n FROM ${Prisma.raw(table)} WHERE ${where}`,
  );
  return CountRows.parse(rows)[0]?.n ?? 0;
}

/** Reorders hydrated rows to keyset order and drops ids that vanished between the two queries. */
export function orderByIds<T extends { id: string }>(ids: string[], rows: T[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [r] : [];
  });
}
