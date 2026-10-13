import { z } from "zod";

export const UuidSchema = z.uuid();
/** ISO-8601 date-time with offset or Z. */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const IanaTimezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimezone, { message: "Invalid IANA timezone" });

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Accepts repeated keys (`a=1&a=2`), comma lists (`a=1,2`) or a single value; always yields a de-duplicated array. */
export function csvArray<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess((v) => {
    if (v == null || v === "") return [];
    const arr = Array.isArray(v) ? v : [v];
    const flat = arr
      .flatMap((x) => (typeof x === "string" ? x.split(",") : [x]))
      .map((x) => (typeof x === "string" ? x.trim() : x));
    return Array.from(new Set(flat.filter((x) => x !== "")));
  }, z.array(item).max(50));
}

/**
 * Strict boolean for query strings. `z.coerce.boolean()` maps "false" → true, so it is banned for query params.
 * Accepts true/false/"true"/"false"/"1"/"0"; absent or "" → undefined (so `.default()` applies); anything else fails.
 */
export function queryBoolean() {
  return z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    if (v === true || v === "true" || v === "1") return true;
    if (v === false || v === "false" || v === "0") return false;
    return v;
  }, z.boolean().optional());
}

/** Integer query param (string → number) bounded to [min, max]. */
export function queryInt(min: number, max: number) {
  return z.coerce.number().int().min(min).max(max);
}

/** Max span between `from` and `to` (docs/02-architecture/05-api-contract.md §1). */
export const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

/**
 * Enforces `to > from` and span ≤ MAX_RANGE_DAYS when both are present; issues land on path `to`.
 * Apply on the final schema only — zod v4 forbids `.extend()` after a refinement.
 */
export function withDateRange<T extends z.ZodType<{ from?: string | undefined; to?: string | undefined }>>(schema: T) {
  return schema.superRefine((v, ctx) => {
    if (!v.from || !v.to) return;
    const span = new Date(v.to).getTime() - new Date(v.from).getTime();
    if (span <= 0) ctx.addIssue({ code: "custom", path: ["to"], message: "to must be after from" });
    else if (span > MAX_RANGE_DAYS * DAY_MS)
      ctx.addIssue({ code: "custom", path: ["to"], message: `Range must not exceed ${MAX_RANGE_DAYS} days` });
  });
}

export const CursorPaginationQuerySchema = z.object({
  cursor: z.string().max(2048).optional(),
  limit: queryInt(1, 100).default(25),
  count: queryBoolean().default(false),
});
export type CursorPaginationQuery = z.infer<typeof CursorPaginationQuerySchema>;

export function pageOf<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    totalCount: z.number().int().nonnegative().optional(),
  });
}

export const LastErrorSchema = z.object({ code: z.string(), message: z.string(), at: IsoDateTimeSchema }).nullable();
export type LastError = z.infer<typeof LastErrorSchema>;

export const UserRefSchema = z.object({
  id: UuidSchema,
  displayName: z.string().nullable(),
  email: z.email().optional(),
});
export type UserRef = z.infer<typeof UserRefSchema>;

/** Route params. */
export const IdParamSchema = z.object({ id: UuidSchema });
export const ProjectIdParamSchema = z.object({ projectId: UuidSchema });

/** 202 response for routes that enqueue a sync job (run, backfill, sync-job retry). */
export const QueuedJobResponseSchema = z.object({ jobId: UuidSchema, status: z.literal("queued") });
export type QueuedJobResponse = z.infer<typeof QueuedJobResponseSchema>;
