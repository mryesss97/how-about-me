import type { ErrorCode } from "@how-about-me/contracts";
import type { ProviderItem } from "../social-discovery.provider";

/**
 * Deterministic Threads fixtures backing `FakeThreadsProvider` (T-013) —
 * docs/02-architecture/02-backend-design.md §10, docs/02-architecture/06-ingestion-pipeline.md §2.
 *
 * A scenario is selected by the listening query's `query_value`, so a test (or a local dev seed) picks a
 * behaviour simply by creating a query with that value. `1zone` / `eventista` are the happy-path datasets
 * used by `pnpm db:seed`; everything prefixed `fake-` exercises one failure mode.
 *
 * Timestamps are **relative to `now`** so fixture posts always fall inside a freshly computed window;
 * the content itself is fixed, so hashes, dedupe and classification stay reproducible.
 *
 * Sanitised recordings of real API responses are added separately in T-025; nothing here is real data,
 * and no fixture contains a token, cookie or personal identifier.
 */

export type ScenarioFailure = {
  code: ErrorCode;
  message: string;
  providerStatus?: number;
  retryAfterMs?: number;
};

export type ScenarioDefinition = {
  key: string;
  description: string;
  /** Pages served in order; an empty array means "one empty page". */
  pages: ProviderItem[][];
  /** Fails the first N provider calls, then serves the pages — drives the Retry-After path (TC-COL-018). */
  transientFailure?: ScenarioFailure & { count: number };
  /** Fails every call (TC-COL-017, TC-COL-021). */
  fatalFailure?: ScenarioFailure;
  /** Serves a body that does not match the expected shape → `THREADS_MALFORMED_RESPONSE`. */
  malformed?: boolean;
  /** From the second run on, the first item's text changes → `revision++`, stale analysis (TC-COL-013). */
  changesTextOnRerun?: boolean;
};

type PostSpec = {
  id: string;
  minutesAgo: number;
  text: string;
  username?: string;
  mediaType?: string;
  linkAttachmentUrl?: string;
};

/** Builds the raw provider shape; `timestamp` is resolved against `now` at call time. */
export function buildItem(spec: PostSpec, now: Date): ProviderItem {
  return {
    id: spec.id,
    timestamp: new Date(now.getTime() - spec.minutesAgo * 60_000).toISOString(),
    text: spec.text,
    username: spec.username ?? "threads_user",
    permalink: `https://www.threads.net/@${spec.username ?? "threads_user"}/post/${spec.id}`,
    shortcode: spec.id.slice(-6),
    media_type: spec.mediaType ?? "TEXT_POST",
    has_replies: spec.minutesAgo % 2 === 0,
    is_quote_post: false,
    ...(spec.linkAttachmentUrl ? { link_attachment_url: spec.linkAttachmentUrl } : {}),
  };
}

/**
 * The shared post that both `1zone` and `eventista` return — one `social_posts` row, two
 * `post_query_matches` rows (BR-001, BR-002; TC-COL-012).
 */
const SHARED_POST: PostSpec = {
  id: "fake_post_overlap_0001",
  minutesAgo: 12,
  text: "Concert 1Zone x Eventista tối qua xịn thật sự, âm thanh ánh sáng quá ổn 🔥",
  username: "minh.concertgoer",
};

const ONE_ZONE_PAGE_1: PostSpec[] = [
  SHARED_POST,
  {
    id: "fake_post_1zone_0002",
    minutesAgo: 25,
    text: "Cho hỏi vé 1Zone đợt này mở bán lúc mấy giờ vậy mọi người? Có early bird không ạ?",
    username: "linh.tran",
  },
  {
    id: "fake_post_1zone_0003",
    minutesAgo: 48,
    text: "Mua vé 1zone mà chờ trong queue gần 2 tiếng, tới lượt thì hết vé. Quá thất vọng 😤",
    username: "hoang.nguyen",
  },
  {
    id: "fake_post_1zone_0004",
    minutesAgo: 95,
    text: "Anyway what time zone is the 1zone livestream in? I'm in Seoul",
    username: "jiwoo_k",
  },
];

const ONE_ZONE_PAGE_2: PostSpec[] = [
  {
    id: "fake_post_1zone_0005",
    minutesAgo: 140,
    text: "Giá vé 1Zone năm nay cao hơn năm ngoái khá nhiều, nhưng line-up thì đáng tiền",
    username: "bao.pham",
  },
  {
    id: "fake_post_1zone_0006",
    minutesAgo: 220,
    text: "SALE SALE SALE vé 1zone giá rẻ inbox ngay kẻo lỡ!!! link bio 👇👇👇",
    username: "ticket_deal_vn",
    linkAttachmentUrl: "https://example.invalid/deal",
  },
  {
    id: "fake_post_1zone_0007",
    minutesAgo: 400,
    text: "Mình định mua membership 1Zone, ai dùng rồi cho xin review với ạ",
    username: "trang.le",
  },
];

const EVENTISTA_PAGE_1: PostSpec[] = [
  SHARED_POST,
  {
    id: "fake_post_eventista_0002",
    minutesAgo: 30,
    text: "App Eventista thanh toán lỗi hoài, trừ tiền rồi mà không thấy vé đâu. CSKH hỗ trợ giúp mình với!",
    username: "quyen.vo",
  },
  {
    id: "fake_post_eventista_0003",
    minutesAgo: 70,
    text: "Eventista check-in nhanh gọn, staff thân thiện, 10 điểm cho khâu tổ chức 👏",
    username: "an.do",
  },
  {
    id: "fake_post_eventista_0004",
    minutesAgo: 160,
    text: "So với mấy bên khác thì Eventista vẫn dễ dùng hơn, nhưng phí dịch vụ hơi chát",
    username: "duc.ngo",
  },
];

const MULTIPAGE: PostSpec[][] = [
  [
    { id: "fake_post_page1_a", minutesAgo: 5, text: "Trang 1 — vé 1zone còn không shop ơi", username: "p1a" },
    { id: "fake_post_page1_b", minutesAgo: 8, text: "Trang 1 — show 1zone hay quá trời", username: "p1b" },
  ],
  [
    { id: "fake_post_page2_a", minutesAgo: 15, text: "Trang 2 — giá vé 1zone bao nhiêu vậy", username: "p2a" },
    { id: "fake_post_page2_b", minutesAgo: 18, text: "Trang 2 — 1zone tổ chức ổn áp", username: "p2b" },
  ],
  [{ id: "fake_post_page3_a", minutesAgo: 30, text: "Trang 3 — hóng vé 1zone đợt tới", username: "p3a" }],
];

const INVALID_ITEMS: ProviderItem[] = [
  { id: "fake_post_invalid_no_timestamp", text: "Item này thiếu timestamp nên phải bị đếm là invalid" },
  { text: "Item này thiếu id luôn", timestamp: "2026-09-15T10:00:00+0000" },
];

function pages(now: Date, specs: PostSpec[][]): ProviderItem[][] {
  return specs.map((page) => page.map((spec) => buildItem(spec, now)));
}

/** Every scenario, resolved against `now`. Keys are matched case-insensitively against `query_value`. */
export function buildScenarios(now: Date): Map<string, ScenarioDefinition> {
  const list: ScenarioDefinition[] = [
    {
      key: "1zone",
      description: "Happy path, 2 pages, includes an irrelevant 'time zone' post and a spam post",
      pages: pages(now, [ONE_ZONE_PAGE_1, ONE_ZONE_PAGE_2]),
    },
    {
      key: "eventista",
      description: "Happy path, 1 page, shares one post with the 1zone scenario (BR-002 overlap)",
      pages: pages(now, [EVENTISTA_PAGE_1]),
    },
    {
      key: "fake-multipage",
      description: "3 pages — pagination and MAX_PAGES cap (TC-COL-007, TC-COL-008)",
      pages: pages(now, MULTIPAGE),
    },
    { key: "fake-empty", description: "One empty page — the '0 mentions' state (BR-032)", pages: [[]] },
    {
      key: "fake-invalid-items",
      description: "Valid and invalid items mixed — records_invalid counter (TC-COL-009)",
      pages: [[buildItem(ONE_ZONE_PAGE_1[0] as PostSpec, now), ...INVALID_ITEMS]],
    },
    {
      key: "fake-changed-text",
      description: "Same post id with different text from the 2nd run on — revision++ (TC-COL-013)",
      pages: pages(now, [[ONE_ZONE_PAGE_1[1] as PostSpec]]),
      changesTextOnRerun: true,
    },
    {
      key: "fake-429",
      description: "One 429 with Retry-After: 3, then success (TC-COL-018)",
      pages: pages(now, [ONE_ZONE_PAGE_1]),
      transientFailure: {
        count: 1,
        code: "THREADS_RATE_LIMITED",
        message: "Application request limit reached",
        providerStatus: 429,
        retryAfterMs: 3_000,
      },
    },
    {
      key: "fake-401",
      description: "Expired token — no retry, integration → expired (TC-COL-021, FR-085)",
      pages: [],
      fatalFailure: {
        code: "THREADS_UNAUTHORIZED",
        message: "Error validating access token: session has expired",
        providerStatus: 401,
      },
    },
    {
      key: "fake-403",
      description: "Missing permission — no retry, integration → permission_error",
      pages: [],
      fatalFailure: {
        code: "THREADS_FORBIDDEN",
        message: "Application does not have permission for this action",
        providerStatus: 403,
      },
    },
    {
      key: "fake-500",
      description: "Persistent upstream error — retried then job failed",
      pages: [],
      fatalFailure: { code: "THREADS_UPSTREAM_ERROR", message: "Internal server error", providerStatus: 500 },
    },
    {
      key: "fake-timeout",
      description: "Request timeout — retryable",
      pages: [],
      fatalFailure: { code: "THREADS_TIMEOUT", message: "Request timed out after 15000 ms" },
    },
    {
      key: "fake-malformed",
      description: "Response shape the adapter cannot parse — no retry",
      pages: [],
      malformed: true,
    },
    {
      key: "fake-400",
      description: "Bad request (invalid query/param) — no retry (TC-COL-019)",
      pages: [],
      fatalFailure: { code: "VALIDATION_ERROR", message: "Invalid parameter: q", providerStatus: 400 },
    },
  ];
  return new Map(list.map((s) => [s.key, s]));
}

export const DEFAULT_SCENARIO_KEY = "1zone";

/** Text substituted on re-runs of `fake-changed-text`. */
export const CHANGED_TEXT = "Cho hỏi vé 1Zone đợt này mở bán lúc mấy giờ vậy mọi người? (đã có lịch rồi nhé cả nhà)";
