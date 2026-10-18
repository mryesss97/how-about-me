import type { AuditLog } from "@how-about-me/contracts";
import { formatCount } from "@/lib/format/number";
import { withBack } from "@/lib/navigation/back-link";
import { queryTypeLabelVi, roleLabelVi, searchModeLabelVi, searchTypeLabelVi } from "@/lib/semantics/labels";
import { formatDateTime } from "@/lib/time/format";
import { auditEntityLabel } from "./format";

// #343 (ops-12): audit log entities become links and metadata renders as fields instead of raw JSON.

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const firstPostId = (metadata: AuditLog["metadata"]): string | null => {
  const ids = metadata?.postIds;
  return Array.isArray(ids) && typeof ids[0] === "string" ? ids[0] : null;
};

const mentionHref = (postId: string) => withBack(`/mentions/${postId}`, "/system-status?tab=audit-log");

/** Where the audited object lives; null for purged data, missing ids, overrides and unknown types (shown as text). */
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
    case "analysis_run": {
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

type NameMaps = { queryNames: Map<string, string>; memberNames: Map<string, string> };

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Human name of the audited object: query/member names when known, otherwise the first 8 chars of the id. */
export function auditEntityName(
  log: Pick<AuditLog, "entityType" | "entityId" | "metadata">,
  { queryNames, memberNames }: NameMaps,
): string | null {
  const id = log.entityId;
  if (!id) return null;
  const meta = log.metadata ?? {};
  if (log.entityType === "listening_query" || log.entityType === "query") {
    const after = isRecord(meta.after) ? str(meta.after.displayName) : null;
    return queryNames.get(id) ?? after ?? id.slice(0, 8);
  }
  if (log.entityType === "member") return memberNames.get(id) ?? str(meta.email) ?? id.slice(0, 8);
  return id.slice(0, 8);
}

/** "Bài nhắc · abcd1234" — entity label plus name; "—"-free (caller renders DASH for a null type). */
export function auditEntityText(log: AuditLog, maps: NameMaps): string | null {
  if (!log.entityType) return null;
  const name = auditEntityName(log, maps);
  return name ? `${auditEntityLabel(log.entityType)} · ${name}` : auditEntityLabel(log.entityType);
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
};

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

export type AuditMetaRow = { key: string; label: string; value: string; href?: string };

const label = (k: string) => META_LABEL[k] ?? k;

function scalarText(v: unknown, tz: string): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Có" : "Không";
  if (typeof v === "number") return formatCount(v);
  if (typeof v === "string") return ISO_RE.test(v) ? formatDateTime(v, tz) : v;
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.map((x) => scalarText(x, tz)).join(", ");
  return JSON.stringify(v);
}

function rowHref(key: string, v: unknown): string | undefined {
  if ((key === "jobId" || key === "sourceJobId") && typeof v === "string")
    return `/system-status?tab=sync-jobs&job=${v}`;
  if (key === "queryId" && typeof v === "string") return `/listening-queries?edit=${v}`;
  if (key === "postIds" && Array.isArray(v) && v.length === 1 && typeof v[0] === "string") return mentionHref(v[0]);
  return undefined;
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
      const keys = [...path, k];
      const labs = [...labels, label(k)];
      if (isRecord(v) && depth < 2) {
        walk(v, keys, labs, depth + 1);
        continue;
      }
      const href = depth === 0 ? rowHref(k, v) : undefined;
      rows.push({
        key: keys.join("."),
        label: labs.join(" › "),
        value: valueText(k, v, tz),
        ...(href ? { href } : {}),
      });
    }
  };
  walk(metadata, [], [], 0);
  return rows;
}
