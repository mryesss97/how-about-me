import type { AuditLog } from "@how-about-me/contracts";
import { formatCount } from "@/lib/format/number";
import { withBack } from "@/lib/navigation/back-link";
import {
  overrideFieldLabelVi,
  queryTypeLabelVi,
  roleLabelVi,
  searchModeLabelVi,
  searchTypeLabelVi,
} from "@/lib/semantics/labels";
import { formatDateTime } from "@/lib/time/format";
import { auditEntityLabel } from "./format";

// #343 (ops-12): audit log entities become links and metadata renders as fields instead of raw JSON.

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const firstPostId = (metadata: AuditLog["metadata"]): string | null => {
  const ids = metadata?.postIds;
  return Array.isArray(ids) && typeof ids[0] === "string" ? ids[0] : null;
};

const mentionHref = (postId: string) => withBack(`/mentions/${postId}`, "/system-status?tab=audit-log");

/** Where the audited object lives; null for purged data, missing ids, legacy overrides without a post id (#393) and unknown types. */
export function auditEntityHref(log: Pick<AuditLog, "action" | "entityType" | "entityId" | "metadata">): string | null {
  const id = log.entityId;
  if (!id || log.action === "data.purged") return null;
  switch (log.entityType) {
    case "social_post":
      return mentionHref(id);
    case "listening_query":
    case "query":
      return `/listening-queries?edit=${id}`;
    case "sync_job":
      return `/system-status?tab=sync-jobs&job=${id}`;
    case "analysis_run":
    case "analysis_override": {
      // #393: override audit metadata carries `postIds: [postId]`; older rows don't and stay text.
      const postId = firstPostId(log.metadata);
      return postId ? mentionHref(postId) : null;
    }
    case "monitoring_project":
    case "project":
      return "/settings/project";
    case "integration_connection":
    case "integration":
      return "/settings/integrations";
    case "member":
      return "/settings/members";
    case "analysis_settings":
      return "/settings/analysis";
    default:
      return null;
  }
}

export type NameMaps = {
  queryNames: Map<string, string>;
  memberNames: Map<string, string>;
  /** Current project; the audit log is project-scoped so project rows name it (#393). */
  project?: { id: string; name: string } | null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

const OVERRIDE_FIELD_LABEL: Record<string, string> = overrideFieldLabelVi;

type EntityLog = Pick<AuditLog, "action" | "entityType" | "entityId" | "metadata">;

/**
 * #393: the audited object in words — label + optional name. Never an id fragment (the full id lives in `title`).
 * `analysis_run` with a post reads "Bài nhắc" since it links to that mention.
 */
export function auditEntityParts(log: EntityLog, maps: NameMaps): { label: string; name: string | null } | null {
  const type = log.entityType;
  if (!type) return null;
  const id = log.entityId;
  const meta = log.metadata ?? {};
  switch (type) {
    case "monitoring_project":
    case "project":
      return { label: auditEntityLabel(type), name: maps.project && id === maps.project.id ? maps.project.name : null };
    case "social_post":
      return { label: auditEntityLabel(type), name: log.action === "data.purged" ? "Đã xoá" : null };
    case "analysis_run":
      return { label: firstPostId(meta) ? auditEntityLabel("social_post") : auditEntityLabel(type), name: null };
    case "analysis_override": {
      const field = str(meta.field);
      return { label: auditEntityLabel(type), name: field ? (OVERRIDE_FIELD_LABEL[field] ?? null) : null };
    }
    case "listening_query":
    case "query": {
      const after = isRecord(meta.after) ? str(meta.after.displayName) : null;
      return { label: auditEntityLabel(type), name: (id ? maps.queryNames.get(id) : undefined) ?? after };
    }
    case "member":
      return { label: auditEntityLabel(type), name: (id ? maps.memberNames.get(id) : undefined) ?? str(meta.email) };
    case "sync_job": {
      const qid = str(meta.queryId);
      return { label: auditEntityLabel(type), name: (qid ? maps.queryNames.get(qid) : undefined) ?? null };
    }
    default:
      return { label: auditEntityLabel(type), name: null };
  }
}

/** Human name of the audited object, or null when only the type label is known (#393: no hex fallback). */
export function auditEntityName(log: EntityLog, maps: NameMaps): string | null {
  return auditEntityParts(log, maps)?.name ?? null;
}

/** "Ghi đè · Cảm xúc" — entity label plus name; label alone when no name; null for a null type (caller renders DASH). */
export function auditEntityText(log: EntityLog, maps: NameMaps): string | null {
  const p = auditEntityParts(log, maps);
  if (!p) return null;
  return p.name ? `${p.label} · ${p.name}` : p.label;
}

/**
 * #393 mobile card: the action line already says e.g. "Ghi đè", so drop the label when the action contains it.
 * Name → name; no name but a link → label (still useful as a link); otherwise null (row omitted).
 */
export function auditEntityCompact(log: EntityLog, actionText: string, maps: NameMaps): { text: string } | null {
  const p = auditEntityParts(log, maps);
  if (!p) return null;
  if (!actionText.toLocaleLowerCase("vi").includes(p.label.toLocaleLowerCase("vi")))
    return { text: p.name ? `${p.label} · ${p.name}` : p.label };
  if (p.name) return { text: p.name };
  return auditEntityHref(log) ? { text: p.label } : null;
}

/** Vietnamese labels for the allow-listed metadata keys (apps/api audit-metadata.ts). Unknown keys stay as is. */
const META_LABEL: Record<string, string> = {
  changes: "Thay đổi",
  before: "Trước",
  after: "Sau",
  fields: "Trường",
  role: "Vai trò",
  previousRole: "Vai trò cũ",
  queryValue: "Giá trị truy vấn",
  queryType: "Loại",
  since: "Từ",
  until: "Đến",
  jobId: "Lượt đồng bộ",
  runId: "Lượt phân tích",
  effectiveVersion: "Phiên bản",
  count: "Số lượng",
  postIds: "Bài nhắc",
  filters: "Bộ lọc",
  format: "Định dạng",
  rowCount: "Số dòng",
  field: "Trường",
  value: "Giá trị",
  reason: "Lý do",
  status: "Trạng thái",
  errorCode: "Mã lỗi",
  name: "Tên",
  email: "Email",
  enabled: "Bật",
  scope: "Phạm vi",
  counts: "Số lượng",
  platformPostId: "Mã bài Threads",
  sourceJobId: "Lượt gốc",
  queryId: "Truy vấn",
  searchType: "Thứ tự lấy",
  searchMode: "Loại",
  displayName: "Tên hiển thị",
  enqueued: "Đã xếp lịch",
  limit: "Giới hạn",
  from: "Từ",
  to: "Đến",
  // #393: keys written by the demo seed, settings diffs and purge counts.
  demo: "Dữ liệu mẫu",
  timezone: "Múi giờ",
  version: "Phiên bản",
  settings: "Cài đặt",
  landingTerms: "Cụm từ trên landing",
  allowAnalystReanalyze: "Cho phép Phân tích viên chạy lại phân tích",
  allowViewerExport: "Cho phép Người xem xuất dữ liệu",
  phraseMinMentions: "Số bài nhắc tối thiểu mỗi cụm từ",
  confidenceBands: "Ngưỡng độ tin cậy",
  high: "Cao",
  medium: "Trung bình",
  safetyThresholds: "Ngưỡng an toàn",
  sensitive: "Nhạy cảm",
  severe: "Nghiêm trọng",
  marked: "Đã đánh dấu",
  matched: "Khớp bộ lọc",
  cap: "Giới hạn",
  syncJobs: "Lượt đồng bộ",
  posts: "Bài nhắc",
  matches: "Lượt khớp",
  overrides: "Ghi đè",
  intents: "Ý định",
  topics: "Chủ đề",
  phrases: "Cụm từ",
  analyses: "Kết quả phân tích",
  runs: "Lượt phân tích",
};

/** #393: metadata keys never listed as fields (ids with nothing to link to); still visible under "Xem JSON". */
const HIDDEN_KEYS = new Set(["runId"]);

/** #344: enum values under these leaf keys are shown in Vietnamese; unknown values stay as stored. */
const META_VALUE: Record<string, Record<string, string>> = {
  searchType: searchTypeLabelVi,
  searchMode: searchModeLabelVi,
  queryType: queryTypeLabelVi,
  role: roleLabelVi,
  previousRole: roleLabelVi,
};

const valueText = (k: string, v: unknown, tz: string): string =>
  (typeof v === "string" ? META_VALUE[k]?.[v] : undefined) ?? scalarText(v, tz);

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

export type AuditMetaRow = { key: string; label: string; value: string; href?: string; title?: string };

/** Whole key first; dotted keys ("settings.landingTerms") are translated per segment (#393). */
const label = (k: string): string =>
  META_LABEL[k] ??
  (k.includes(".")
    ? k
        .split(".")
        .map((seg) => META_LABEL[seg] ?? seg)
        .join(" › ")
    : k);

function scalarText(v: unknown, tz: string): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Có" : "Không";
  if (typeof v === "number") return formatCount(v);
  if (typeof v === "string") return ISO_RE.test(v) ? formatDateTime(v, tz) : v;
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.map((x) => scalarText(x, tz)).join(", ");
  return JSON.stringify(v);
}

/** #343/#393: top-level id keys become links whose text is words; the raw id goes to `title`. */
function idRow(key: string, v: unknown): Pick<AuditMetaRow, "value" | "href" | "title"> | null {
  if ((key === "jobId" || key === "sourceJobId") && typeof v === "string")
    return { value: "Mở lượt đồng bộ", href: `/system-status?tab=sync-jobs&job=${v}`, title: v };
  if (key === "queryId" && typeof v === "string")
    return { value: "Mở truy vấn", href: `/listening-queries?edit=${v}`, title: v };
  if (key === "postIds" && Array.isArray(v) && v.length > 0) {
    const ids = v.filter((x): x is string => typeof x === "string");
    const [only] = ids;
    if (only && v.length === 1) return { value: "Mở bài nhắc", href: mentionHref(only), title: only };
    return { value: `${formatCount(v.length)} bài nhắc`, title: ids.join(", ") };
  }
  return null;
}

/**
 * Sanitized metadata (FR-200) → label/value rows. Nested objects (before/after/changes/counts/filters) flatten up to
 * 2 levels as "Sau › Tên hiển thị"; deeper values are shown as JSON. `{ truncated: true }` → one explanatory row.
 */
export function auditMetadataRows(metadata: AuditLog["metadata"], tz: string): AuditMetaRow[] {
  if (!metadata) return [];
  if (metadata.truncated === true && Object.keys(metadata).length === 1)
    return [{ key: "truncated", label: "Ghi chú", value: "Dữ liệu bị rút gọn" }];
  const rows: AuditMetaRow[] = [];
  const walk = (obj: Record<string, unknown>, path: string[], labels: string[], depth: number) => {
    for (const [k, v] of Object.entries(obj)) {
      if (depth === 0 && HIDDEN_KEYS.has(k)) continue;
      const keys = [...path, k];
      const labs = [...labels, label(k)];
      if (isRecord(v) && depth < 2) {
        walk(v, keys, labs, depth + 1);
        continue;
      }
      const id = depth === 0 ? idRow(k, v) : null;
      rows.push({ key: keys.join("."), label: labs.join(" › "), value: valueText(k, v, tz), ...(id ?? {}) });
    }
  };
  walk(metadata, [], [], 0);
  return rows;
}
