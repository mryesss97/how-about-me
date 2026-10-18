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
  pollIntervalSeconds: string;
  overlapSeconds: string;
  initialBackfillDays: string;
  enabled: boolean;
};

export type QueryFormField = keyof QueryFormValues;
export type QueryFormErrors = Partial<Record<QueryFormField, string>>;
export type QueryFormMode = "create" | "edit";

/** Poll interval presets (UX §3.5): 5/10/30/60 minutes. */
export const INTERVAL_PRESETS = [
  { seconds: 300, label: "5 phút" },
  { seconds: 600, label: "10 phút" },
  { seconds: 1800, label: "30 phút" },
  { seconds: 3600, label: "60 phút" },
] as const;

/** Overlap presets: 10/20/60 minutes (default 1200s from the contract). */
export const OVERLAP_PRESETS = [
  { seconds: 600, label: "10 phút" },
  { seconds: 1200, label: "20 phút" },
  { seconds: 3600, label: "60 phút" },
] as const;

/** Vietnamese message per field for FR-052 violations. */
export const FIELD_MESSAGES: Record<QueryFormField, string> = {
  displayName: "Tên hiển thị 1–80 ký tự.",
  queryValue: "Giá trị truy vấn 1–100 ký tự (không tính dấu #).",
  queryType: "Chọn loại truy vấn.",
  excludeTerms: "Tối đa 50 cụm từ, mỗi cụm ≤ 100 ký tự.",
  includeTerms: "Tối đa 50 cụm từ, mỗi cụm ≤ 100 ký tự.",
  pollIntervalSeconds: "Chu kỳ quét 60–86400 giây.",
  overlapSeconds: "Chồng lấn 0–86400 giây.",
  initialBackfillDays: "Lấy dữ liệu cũ 0–30 ngày.",
  enabled: "Giá trị không hợp lệ.",
};

const FIELDS = Object.keys(FIELD_MESSAGES) as QueryFormField[];
const isField = (k: unknown): k is QueryFormField => typeof k === "string" && (FIELDS as string[]).includes(k);

/** Defaults mirror CreateListeningQueryBodySchema: 600 / 1200 / 1 / enabled. */
export function emptyValues(): QueryFormValues {
  return {
    displayName: "",
    queryValue: "",
    queryType: "keyword",
    excludeTerms: [],
    includeTerms: [],
    pollIntervalSeconds: "600",
    overlapSeconds: "1200",
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
    pollIntervalSeconds: String(q.pollIntervalSeconds),
    overlapSeconds: String(q.overlapSeconds),
    initialBackfillDays: String(q.initialBackfillDays),
    enabled: q.enabled,
  };
}

/** "" or non-integer text → NaN, which the schema rejects (never sent). */
const toInt = (s: string): number => (/^-?\d+$/.test(s.trim()) ? Number(s.trim()) : Number.NaN);

function rawCreate(v: QueryFormValues) {
  return {
    displayName: v.displayName,
    queryValue: v.queryValue,
    queryType: v.queryType,
    excludeTerms: v.excludeTerms,
    includeTerms: v.includeTerms,
    pollIntervalSeconds: toInt(v.pollIntervalSeconds),
    overlapSeconds: toInt(v.overlapSeconds),
    initialBackfillDays: toInt(v.initialBackfillDays),
    enabled: v.enabled,
  };
}

function issuesToErrors(issues: readonly { path: readonly PropertyKey[] }[]): QueryFormErrors {
  const out: QueryFormErrors = {};
  for (const i of issues) {
    const f = i.path[0];
    if (isField(f)) out[f] ??= FIELD_MESSAGES[f];
  }
  return out;
}

/** FR-052: validate with the contract schema; edit mode skips the immutable fields (FR-054). */
export function validate(values: QueryFormValues, mode: QueryFormMode): QueryFormErrors {
  const raw = rawCreate(values);
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
  const { queryValue: _v, queryType: _t, ...raw } = rawCreate(values);
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
