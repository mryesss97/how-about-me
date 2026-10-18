import { describe, expect, it } from "vitest";
import {
  auditEntityCompact,
  auditEntityHref,
  auditEntityName,
  auditEntityText,
  auditMetadataRows,
} from "./audit-format";
import { auditLogFixture } from "./fixtures.test-utils";

const ID = "11111111-2222-4333-8444-555555555555";
const log = (entityType: string | null, over: Parameters<typeof auditLogFixture>[0] = {}) =>
  auditLogFixture({ entityType, entityId: ID, action: "query.updated", metadata: null, ...over });
const back = encodeURIComponent("/system-status?tab=audit-log");

describe("#343 auditEntityHref (FR-201, ops-12)", () => {
  it.each([
    ["social_post", `/mentions/${ID}?back=${back}`],
    ["listening_query", `/listening-queries?edit=${ID}`],
    ["query", `/listening-queries?edit=${ID}`],
    ["sync_job", `/system-status?tab=sync-jobs&job=${ID}`],
    ["monitoring_project", "/settings/project"],
    ["project", "/settings/project"],
    ["integration_connection", "/settings/integrations"],
    ["integration", "/settings/integrations"],
    ["member", "/settings/members"],
    ["analysis_settings", "/settings/analysis"],
  ])("%s → %s", (type, href) => {
    expect(auditEntityHref(log(type))).toBe(href);
  });

  it("analysis_run links to metadata.postIds[0], else null", () => {
    expect(auditEntityHref(log("analysis_run", { metadata: { postIds: ["p-1"] } }))).toBe(`/mentions/p-1?back=${back}`);
    expect(auditEntityHref(log("analysis_run"))).toBeNull();
  });

  it("#393: override links to metadata.postIds[0]; legacy rows without it → null", () => {
    expect(auditEntityHref(log("analysis_override", { metadata: { field: "sentiment", postIds: ["p1"] } }))).toBe(
      `/mentions/p1?back=${back}`,
    );
    expect(auditEntityHref(log("analysis_override", { metadata: { field: "sentiment" } }))).toBeNull();
  });

  it("legacy override, unknown type, data.purged and null id → null", () => {
    expect(auditEntityHref(log("analysis_override"))).toBeNull();
    expect(auditEntityHref(log("weird_thing"))).toBeNull();
    expect(auditEntityHref(log("social_post", { action: "data.purged" }))).toBeNull();
    expect(auditEntityHref(log("social_post", { entityId: null }))).toBeNull();
  });
});

describe("#343 auditEntityName", () => {
  const empty = { queryNames: new Map<string, string>(), memberNames: new Map<string, string>() };
  it("query name from the names map, then metadata.after.displayName, then none (#393: no id prefix)", () => {
    expect(auditEntityName(log("query"), { ...empty, queryNames: new Map([[ID, "1zone"]]) })).toBe("1zone");
    expect(auditEntityName(log("query", { metadata: { after: { displayName: "Cũ" } } }), empty)).toBe("Cũ");
    expect(auditEntityName(log("query"), empty)).toBeNull();
    expect(auditEntityName(log("member"), empty)).toBeNull();
  });
  it("member name from members, then metadata.email", () => {
    expect(auditEntityName(log("member"), { ...empty, memberNames: new Map([[ID, "Lan"]]) })).toBe("Lan");
    expect(auditEntityName(log("member", { metadata: { email: "a@b.c" } }), empty)).toBe("a@b.c");
  });
});

describe("#393 auditEntityText names objects in words (FR-201)", () => {
  const empty = { queryNames: new Map<string, string>(), memberNames: new Map<string, string>() };
  const project = { id: ID, name: "1Zone Demo" };
  it("project → current project name when the id matches, else label only", () => {
    expect(auditEntityText(log("monitoring_project"), { ...empty, project })).toBe("Dự án · 1Zone Demo");
    expect(auditEntityText(log("project", { entityId: "other" }), { ...empty, project })).toBe("Dự án");
    expect(auditEntityText(log("monitoring_project"), empty)).toBe("Dự án");
  });
  it("override → field label; unknown/missing field → label only", () => {
    const o = (metadata: Record<string, unknown> | null) => log("analysis_override", { metadata });
    expect(auditEntityText(o({ field: "sentiment", postIds: ["p1"] }), empty)).toBe("Ghi đè · Cảm xúc");
    expect(auditEntityText(o({ field: "weird" }), empty)).toBe("Ghi đè");
    expect(auditEntityText(o(null), empty)).toBe("Ghi đè");
  });
  it("mentions: social_post, analysis_run with/without post, purged", () => {
    expect(auditEntityText(log("social_post"), empty)).toBe("Bài nhắc");
    expect(auditEntityText(log("analysis_run", { metadata: { postIds: ["p1"] } }), empty)).toBe("Bài nhắc");
    expect(auditEntityText(log("analysis_run"), empty)).toBe("Lượt phân tích");
    const purged = log("social_post", { action: "data.purged" });
    expect(auditEntityText(purged, empty)).toBe("Bài nhắc · Đã xoá");
    expect(auditEntityHref(purged)).toBeNull();
  });
  it("sync_job → query name from metadata.queryId", () => {
    const names = { ...empty, queryNames: new Map([["q1", "1zone"]]) };
    expect(auditEntityText(log("sync_job", { metadata: { queryId: "q1" } }), names)).toBe("Lượt đồng bộ · 1zone");
    expect(auditEntityText(log("sync_job"), names)).toBe("Lượt đồng bộ");
  });
  it.each([
    "social_post",
    "analysis_override",
    "analysis_run",
    "analysis_settings",
    "monitoring_project",
    "project",
    "member",
    "query",
    "listening_query",
    "integration",
    "integration_connection",
    "sync_job",
    "weird_thing",
  ])("%s never shows an id fragment", (type) => {
    expect(auditEntityText(log(type), empty)).not.toMatch(/[0-9a-f]{8}/);
  });
});

describe("#393 auditEntityCompact (mobile card, no repeated action word)", () => {
  const empty = { queryNames: new Map<string, string>(), memberNames: new Map<string, string>() };
  const o = (metadata: Record<string, unknown> | null) => log("analysis_override", { metadata });
  it("override: action already says 'Ghi đè' → field only", () => {
    expect(auditEntityCompact(o({ field: "sentiment", postIds: ["p1"] }), "Ghi đè", empty)).toEqual({
      text: "Cảm xúc",
    });
    expect(auditEntityCompact(o({ field: "sentiment" }), "Thu hồi ghi đè", empty)).toEqual({ text: "Cảm xúc" });
    expect(auditEntityCompact(o(null), "Ghi đè", empty)).toBeNull();
  });
  it("no name but a link → label; action without the label → full text", () => {
    expect(auditEntityCompact(log("sync_job"), "Thử lại lượt đồng bộ", empty)).toEqual({ text: "Lượt đồng bộ" });
    expect(auditEntityCompact(log("social_post"), "Đánh dấu cần xem", empty)).toEqual({ text: "Bài nhắc" });
  });
});

describe("#343 auditMetadataRows (FR-200 sanitized metadata as fields)", () => {
  const tz = "Asia/Ho_Chi_Minh";
  it("scalars, booleans, arrays and labels", () => {
    const rows = auditMetadataRows({ role: "analyst", enabled: false, postIds: ["a", "b"], weird: 3 }, tz);
    expect(rows).toEqual([
      { key: "role", label: "Vai trò", value: "Phân tích" },
      { key: "enabled", label: "Bật", value: "Không" },
      { key: "postIds", label: "Bài nhắc", value: "2 bài nhắc", title: "a, b" },
      { key: "weird", label: "weird", value: "3" },
    ]);
  });
  it("flattens before/after and formats ISO dates in the project tz (BR-028)", () => {
    const rows = auditMetadataRows(
      { after: { displayName: "Mới" }, since: "2026-10-13T17:30:00.000Z", note: null },
      tz,
    );
    expect(rows[0]).toEqual({ key: "after.displayName", label: "Sau › Tên hiển thị", value: "Mới" });
    expect(rows[1]?.value).toContain("14");
    expect(rows[1]?.value).not.toContain("T17");
    expect(rows[2]?.value).toBe("—");
  });
  it("#393: links job ids and a single post id with words; raw id only in title; runId hidden", () => {
    const rows = auditMetadataRows({ jobId: "j1", postIds: ["p1"], queryId: "q1", runId: "r1" }, tz);
    expect(rows).toEqual([
      {
        key: "jobId",
        label: "Lượt đồng bộ",
        value: "Mở lượt đồng bộ",
        href: "/system-status?tab=sync-jobs&job=j1",
        title: "j1",
      },
      { key: "postIds", label: "Bài nhắc", value: "Mở bài nhắc", href: `/mentions/p1?back=${back}`, title: "p1" },
      { key: "queryId", label: "Truy vấn", value: "Mở truy vấn", href: "/listening-queries?edit=q1", title: "q1" },
    ]);
  });
  it("#393: demo, dotted keys and count keys are labelled", () => {
    expect(auditMetadataRows({ demo: true }, tz)).toEqual([{ key: "demo", label: "Dữ liệu mẫu", value: "Có" }]);
    const changes = auditMetadataRows({ changes: { "settings.landingTerms": { from: 1, to: 2 } } }, tz);
    expect(changes[0]?.label).toBe("Thay đổi › Cài đặt › Cụm từ trên landing › Từ");
    expect(changes.every((r) => !r.label.includes("settings"))).toBe(true);
    expect(auditMetadataRows({ counts: { marked: 2 } }, tz)[0]?.label).toBe("Số lượng › Đã đánh dấu");
    expect(auditMetadataRows({ changes: ["safetyThresholds.hate.severe"] }, tz)[0]?.label).toBe("Thay đổi");
  });
  it("{ truncated: true } → one row", () => {
    expect(auditMetadataRows({ truncated: true }, tz)).toEqual([
      { key: "truncated", label: "Ghi chú", value: "Dữ liệu bị rút gọn" },
    ]);
  });
});

describe("auditMetadataRows enum values (#344)", () => {
  const tz = "Asia/Ho_Chi_Minh";
  it("translates searchType and nested queryType; unknown values stay as stored", () => {
    expect(auditMetadataRows({ searchType: "TOP" }, tz)).toEqual([
      { key: "searchType", label: "Thứ tự lấy", value: "Nổi bật trước" },
    ]);
    expect(auditMetadataRows({ after: { queryType: "topic_tag" } }, tz)).toEqual([
      { key: "after.queryType", label: "Sau › Loại", value: "Chủ đề" },
    ]);
    expect(auditMetadataRows({ searchType: "WEIRD" }, tz)[0]?.value).toBe("WEIRD");
  });
});
