import { createHash } from "node:crypto";
import type { ProviderItem } from "../integrations/threads/social-discovery.provider";

/**
 * Provider item → `NormalizedPost` plus per-page validation counters.
 *
 * Pure functions (no DI, no DB) — docs/02-architecture/06-ingestion-pipeline.md §6 ·
 * FR-074 (validation), FR-075 (content hash), FR-079 (raw_data) · BR-003, BR-037, BR-038.
 */

/**
 * The only provider fields we request and the only ones kept in `raw_data` (BR-038: no enrichment,
 * BR-037: media binaries are never stored — URLs only) — docs/02-architecture/06-ingestion-pipeline.md §2.
 */
export const REQUESTED_PROVIDER_FIELDS = [
  "id",
  "media_type",
  "media_url",
  "permalink",
  "username",
  "text",
  "timestamp",
  "shortcode",
  "thumbnail_url",
  "is_quote_post",
  "quoted_post",
  "reposted_post",
  "has_replies",
  "alt_text",
  "link_attachment_url",
  "owner",
] as const;

/** `raw_data` budget; beyond it only first-level scalars are kept and `rawTruncated` is set (FR-079). */
export const RAW_DATA_MAX_BYTES = 32 * 1024;

/** Column-shaped result; `projectId`/`platform` are added by `IngestionService` (T-051). */
export type NormalizedPost = {
  platformPostId: string;
  username: string | null;
  ownerId: string | null;
  text: string;
  permalink: string | null;
  shortcode: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  altText: string | null;
  linkAttachmentUrl: string | null;
  isQuotePost: boolean | null;
  hasReplies: boolean | null;
  quotedPostId: string | null;
  repostedPostId: string | null;
  publishedAt: Date;
  contentHash: string;
  rawData: Record<string, unknown>;
  rawTruncated: boolean;
};

export type InvalidReason = "missing_id" | "missing_timestamp" | "invalid_timestamp";
export type InvalidItem = { platformPostId: string | null; reason: InvalidReason };

/** `records_fetched = valid.length + invalid.length`; `records_invalid = invalid.length` (FR-080). */
export type NormalizeResult = { valid: NormalizedPost[]; invalid: InvalidItem[] };

/**
 * BR-003: identity of the *content*. Text is NFC-normalised first so the same post re-delivered in a
 * different Unicode composition does not look like an edit (TC-COL-010).
 */
export function computeContentHash(input: {
  text: string;
  mediaType?: string | null;
  linkAttachmentUrl?: string | null;
}) {
  const payload = `${input.text.normalize("NFC")}|${input.mediaType ?? ""}|${input.linkAttachmentUrl ?? ""}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/** Accepts ISO 8601 with `+0000` (Threads) as well as `+00:00`; returns `null` when unparseable. */
export function parseProviderTimestamp(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const iso = value.trim().replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** One provider item → a row, or the reason it is counted as invalid (TC-COL-009). */
export function normalizeItem(
  item: ProviderItem,
): { ok: true; post: NormalizedPost } | { ok: false; invalid: InvalidItem } {
  const platformPostId = str(item["id"]);
  if (!platformPostId) return { ok: false, invalid: { platformPostId: null, reason: "missing_id" } };

  const rawTimestamp = item["timestamp"];
  if (rawTimestamp === undefined || rawTimestamp === null || rawTimestamp === "")
    return { ok: false, invalid: { platformPostId, reason: "missing_timestamp" } };
  const publishedAt = parseProviderTimestamp(rawTimestamp);
  if (!publishedAt) return { ok: false, invalid: { platformPostId, reason: "invalid_timestamp" } };

  const text = (str(item["text"]) ?? "").trim().normalize("NFC");
  const mediaType = str(item["media_type"]);
  const linkAttachmentUrl = str(item["link_attachment_url"]);
  const { rawData, rawTruncated } = buildRawData(item);

  return {
    ok: true,
    post: {
      platformPostId,
      username: str(item["username"]),
      ownerId: refId(item["owner"]),
      text,
      permalink: str(item["permalink"]),
      shortcode: str(item["shortcode"]),
      mediaType,
      mediaUrl: str(item["media_url"]),
      thumbnailUrl: str(item["thumbnail_url"]),
      altText: str(item["alt_text"]),
      linkAttachmentUrl,
      isQuotePost: bool(item["is_quote_post"]),
      hasReplies: bool(item["has_replies"]),
      quotedPostId: refId(item["quoted_post"]),
      repostedPostId: refId(item["reposted_post"]),
      publishedAt,
      contentHash: computeContentHash({ text, mediaType, linkAttachmentUrl }),
      rawData,
      rawTruncated,
    },
  };
}

/** One provider page → rows + invalid counters. Order of `valid` follows the provider order. */
export function normalizePage(items: readonly ProviderItem[]): NormalizeResult {
  const result: NormalizeResult = { valid: [], invalid: [] };
  for (const item of items) {
    const outcome = normalizeItem(item);
    if (outcome.ok) result.valid.push(outcome.post);
    else result.invalid.push(outcome.invalid);
  }
  return result;
}

/**
 * FR-079: keep only requested fields; if the JSON exceeds `RAW_DATA_MAX_BYTES`, keep first-level scalars
 * only (and, in the pathological case where those alone are still too large, shorten the longest strings)
 * and flag the row so the UI can say the raw payload is partial (TC-COL-014).
 */
export function buildRawData(item: ProviderItem): { rawData: Record<string, unknown>; rawTruncated: boolean } {
  const picked: Record<string, unknown> = {};
  for (const field of REQUESTED_PROVIDER_FIELDS) {
    const value = item[field];
    if (value !== undefined) picked[field] = value;
  }
  if (jsonBytes(picked) <= RAW_DATA_MAX_BYTES) return { rawData: picked, rawTruncated: false };

  const scalars: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(picked)) {
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) scalars[key] = value;
  }
  while (jsonBytes(scalars) > RAW_DATA_MAX_BYTES) {
    const longest = Object.entries(scalars)
      .filter((e): e is [string, string] => typeof e[1] === "string" && e[1].length > 1)
      .sort((a, b) => b[1].length - a[1].length)[0];
    if (!longest) break;
    scalars[longest[0]] = longest[1].slice(0, Math.floor(longest[1].length / 2));
  }
  return { rawData: scalars, rawTruncated: true };
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** `quoted_post` / `reposted_post` / `owner` come back either as `{ id }` or as a bare id string. */
function refId(value: unknown): string | null {
  if (typeof value === "string") return value.length > 0 ? value : null;
  if (value && typeof value === "object") return str((value as Record<string, unknown>)["id"]);
  return null;
}
