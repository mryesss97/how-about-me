import { describe, expect, it } from "vitest";
import { auditEntityHref, auditEntityName, auditMetadataRows } from "./audit-format";
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

  it("override, unknown type, data.purged and null id → null", () => {
    expect(auditEntityHref(log("analysis_override"))).toBeNull();
    expect(auditEntityHref(log("weird_thing"))).toBeNull();
    expect(auditEntityHref(log("social_post", { action: "data.purged" }))).toBeNull();
    expect(auditEntityHref(log("social_post", { entityId: null }))).toBeNull();
  });
});

describe("#343 auditEntityName", () => {
  const empty = { queryNames: new Map<string, string>(), memberNames: new Map<string, string>() };
  it("query name from the names map, then metadata.after.displayName, then id prefix", () => {
    expect(auditEntityName(log("query"), { ...empty, queryNames: new Map([[ID, "1zone"]]) })).toBe("1zone");
    expect(auditEntityName(log("query", { metadata: { after: { displayName: "Cũ" } } }), empty)).toBe("Cũ");
    expect(auditEntityName(log("query"), empty)).toBe("11111111");
  });
  it("member name from members, then metadata.email", () => {
    expect(auditEntityName(log("member"), { ...empty, memberNames: new Map([[ID, "Lan"]]) })).toBe("Lan");
    expect(auditEntityName(log("member", { metadata: { email: "a@b.c" } }), empty)).toBe("a@b.c");
  });
});

describe("#343 auditMetadataRows (FR-200 sanitized metadata as fields)", () => {
  const tz = "Asia/Ho_Chi_Minh";
  it("scalars, booleans, arrays and labels", () => {
    const rows = auditMetadataRows({ role: "analyst", enabled: false, postIds: ["a", "b"], weird: 3 }, tz);
    expect(rows).toEqual([
      { key: "role", label: "Vai trò", value: "Phân tích" },
      { key: "enabled", label: "Bật", value: "Không" },
      { key: "postIds", label: "Bài nhắc", value: "a, b" },
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
  it("links job ids and a single post id", () => {
    const rows = auditMetadataRows({ jobId: "j1", postIds: ["p1"] }, tz);
    expect(rows[0]?.href).toBe("/system-status?tab=sync-jobs&job=j1");
    expect(rows[1]?.href).toBe(`/mentions/p1?back=${back}`);
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
