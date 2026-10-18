import {
  CreateListeningQueryBodySchema,
  UpdateListeningQueryBodySchema,
  ValidationErrorDetailsSchema,
  type CreateListeningQueryBody,
  type ListeningQuery,
  type QueryType,
  type UpdateListeningQueryBody,
} from "@how-about-me/contracts";

/** Form state for the create/edit drawer (FR-052). Numeric inputs stay strings so "" / "abc" never become NaN. */
export type QueryFormValues = {
  displayName: string;
  queryValue: string;
  queryType: QueryType;
  excludeTerms: string[];
  includeTerms: string[];
  /** Minutes in the UI (#341); sent to the API as seconds. */
  pollIntervalMinutes: string;
  overlapMinutes: string;
  initialBackfillDays: string;
  enabled: boolean;
};

export type QueryFormField = keyof QueryFormValues;
export type QueryFormErrors = Partial<Record<QueryFormField, string>>;
export type QueryFormMode = "create" | "edit";

/** Poll interval presets (UX §3.5): 5/10/30/60 minutes. */
export const INTERVAL_PRESETS = [
  { minutes: 5, label: "5 phút" },
  { minutes: 10, label: "10 phút" },
  { minutes: 30, label: "30 phút" },
  { minutes: 60, label: "60 phút" },
] as const;

/** Overlap presets: 10/20/60 minutes (default 1200s = 20 min from the contract). */
export const OVERLAP_PRESETS = [
  { minutes: 10, label: "10 phút" },
  { minutes: 20, label: "20 phút" },
  { minutes: 60, label: "60 phút" },
] as const;

/** Default overlap in minutes; "Nâng cao" auto-opens when the value differs (#341). */
export const DEFAULT_OVERLAP_MINUTES = "20";

/** Vietnamese message per field for FR-052 violations. */
export const FIELD_MESSAGES: Record<QueryFormField, string> = {
  displayName: "Tên hiển thị 1–80 ký tự.",
  queryValue: "Giá trị truy vấn 1–100 ký tự (không tính dấu #).",
  queryType: "Chọn loại truy vấn.",
  excludeTerms: "Tối đa 50 cụm từ, mỗi cụm ≤ 100 ký tự.",
  includeTerms: "Tối đa 50 cụm từ, mỗi cụm ≤ 100 ký tự.",
  pollIntervalMinutes: "Chu kỳ quét 1–1440 phút.",
  overlapMinutes: "Chồng lấn 0–1440 phút.",
  initialBackfillDays: "Lấy dữ liệu cũ 0–30 ngày.",
  enabled: "Giá trị không hợp lệ.",
};

const FIELDS = Object.keys(FIELD_MESSAGES) as QueryFormField[];
const isField = (k: unknown): k is QueryFormField => typeof k === "string" && (FIELDS as string[]).includes(k);
/** Contract (seconds) paths → form (minutes) fields, for client and server issues alike. */
const PATH_ALIASES: Record<string, QueryFormField> = {
  pollIntervalSeconds: "pollIntervalMinutes",
  overlapSeconds: "overlapMinutes",
};

/** Seconds → minutes text; legacy values not divisible by 60 show as a decimal ("1,5"). */
export const secondsToMinutesText = (s: number): string => String(s / 60).replace(".", ",");

/** Defaults mirror CreateListeningQueryBodySchema: 600 / 1200 / 1 / enabled. */
export function emptyValues(): QueryFormValues {
  return {
    displayName: "",
    queryValue: "",
    queryType: "keyword",
    excludeTerms: [],
    includeTerms: [],
    pollIntervalMinutes: "10",
    overlapMinutes: DEFAULT_OVERLAP_MINUTES,
    initialBackfillDays: "1",
    enabled: true,
  };
}

export function valuesFromQuery(q: ListeningQuery): QueryFormValues {
  return {
    displayName: q.displayName,
    queryValue: q.queryValue,
    queryType: q.queryType,
    excludeTerms: [...q.excludeTerms],
    includeTerms: [...q.includeTerms],
    pollIntervalMinutes: secondsToMinutesText(q.pollIntervalSeconds),
    overlapMinutes: secondsToMinutesText(q.overlapSeconds),
    initialBackfillDays: String(q.initialBackfillDays),
    enabled: q.enabled,
  };
}

/** "" or non-integer text → NaN, which the schema rejects (never sent). */
const toInt = (s: string): number => (/^-?\d+$/.test(s.trim()) ? Number(s.trim()) : Number.NaN);

/**
 * Whole minutes → seconds; anything else → NaN (schema rejects). An untouched legacy value keeps the
 * original seconds so edit never sends a fake diff (#341).
 */
function toSeconds(text: string, originalSeconds?: number): number {
  if (originalSeconds !== undefined && text === secondsToMinutesText(originalSeconds)) return originalSeconds;
  const t = text.trim();
  return /^\d+$/.test(t) ? Number(t) * 60 : Number.NaN;
}

function rawCreate(v: QueryFormValues, original?: ListeningQuery) {
  return {
    displayName: v.displayName,
    queryValue: v.queryValue,
    queryType: v.queryType,
    excludeTerms: v.excludeTerms,
    includeTerms: v.includeTerms,
    pollIntervalSeconds: toSeconds(v.pollIntervalMinutes, original?.pollIntervalSeconds),
    overlapSeconds: toSeconds(v.overlapMinutes, original?.overlapSeconds),
    initialBackfillDays: toInt(v.initialBackfillDays),
    enabled: v.enabled,
  };
}

function issuesToErrors(issues: readonly { path: readonly PropertyKey[] }[]): QueryFormErrors {
  const out: QueryFormErrors = {};
  for (const i of issues) {
    const p = i.path[0];
    const f = typeof p === "string" ? (PATH_ALIASES[p] ?? p) : p;
    if (isField(f)) out[f] ??= FIELD_MESSAGES[f];
  }
  return out;
}

/** FR-052: validate with the contract schema; edit mode skips the immutable fields (FR-054). */
export function validate(values: QueryFormValues, mode: QueryFormMode, original?: ListeningQuery): QueryFormErrors {
  const raw = rawCreate(values, original);
  if (mode === "create") {
    const r = CreateListeningQueryBodySchema.safeParse(raw);
    return r.success ? {} : issuesToErrors(r.error.issues);
  }
  const { queryValue: _v, queryType: _t, ...mutable } = raw;
  const r = UpdateListeningQueryBodySchema.safeParse(mutable);
  return r.success ? {} : issuesToErrors(r.error.issues);
}

/** Parsed create body (BR-004 strips the leading `#`), or null when invalid. */
export function toCreateBody(values: QueryFormValues): CreateListeningQueryBody | null {
  const r = CreateListeningQueryBodySchema.safeParse(rawCreate(values));
  return r.success ? r.data : null;
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * PATCH body with only the changed fields; never carries queryValue/queryType (FR-054, BR-009).
 * Returns null when nothing changed or the values are invalid.
 */
export function toUpdateBody(values: QueryFormValues, original: ListeningQuery): UpdateListeningQueryBody | null {
  const { queryValue: _v, queryType: _t, ...raw } = rawCreate(values, original);
  const diff: Record<string, unknown> = {};
  if (raw.displayName.trim() !== original.displayName) diff.displayName = raw.displayName;
  if (!sameList(raw.excludeTerms, original.excludeTerms)) diff.excludeTerms = raw.excludeTerms;
  if (!sameList(raw.includeTerms, original.includeTerms)) diff.includeTerms = raw.includeTerms;
  if (raw.pollIntervalSeconds !== original.pollIntervalSeconds) diff.pollIntervalSeconds = raw.pollIntervalSeconds;
  if (raw.overlapSeconds !== original.overlapSeconds) diff.overlapSeconds = raw.overlapSeconds;
  if (raw.initialBackfillDays !== original.initialBackfillDays) diff.initialBackfillDays = raw.initialBackfillDays;
  if (raw.enabled !== original.enabled) diff.enabled = raw.enabled;
  if (Object.keys(diff).length === 0) return null;
  const r = UpdateListeningQueryBodySchema.safeParse(diff);
  return r.success ? r.data : null;
}

/** Map `details.issues[].path` ("field" or "field.0") of a 400 VALIDATION_ERROR to form fields. */
export function serverIssuesToErrors(details: unknown): QueryFormErrors {
  const r = ValidationErrorDetailsSchema.safeParse(details);
  if (!r.success) return {};
  return issuesToErrors(r.data.issues.map((i) => ({ path: i.path.split(".") })));
}

/** Display name suggested from the query value in create mode (#341); BR-004 drops the leading `#`. */
export const suggestDisplayName = (queryValue: string): string => queryValue.trim().replace(/^#+/, "");
