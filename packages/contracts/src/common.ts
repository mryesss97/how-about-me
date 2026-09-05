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

export const CursorPaginationQuerySchema = z.object({
  cursor: z.string().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  count: z.coerce.boolean().default(false),
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
