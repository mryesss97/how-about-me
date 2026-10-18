import { JOB_STATUSES } from "@how-about-me/contracts";
import { describe, expect, it } from "vitest";
import { queryFixture } from "./fixtures.test-utils";
import {
  formatDuration,
  formatQueryValue,
  isJobActive,
  isStaleError,
  mentionsWindowHref,
  querySubline,
  syncErrorLabel,
  syncStatus,
  truncateError,
} from "./format";

const JOB = {
  id: "00000000-0000-4000-8000-000000000999",
  status: "success" as const,
  recordsFetched: 1,
  recordsInserted: 1,
  completedAt: null,
};

describe("listening-queries format", () => {
  it("BR-004 / TC-LQ-001: topic tags show a leading #, keywords do not", () => {
    expect(formatQueryValue({ queryType: "topic_tag", queryValue: "concert" })).toBe("#concert");
    expect(formatQueryValue({ queryType: "keyword", queryValue: "concert" })).toBe("concert");
  });

  it("BR-017: every job status maps to a non-empty text label", () => {
    for (const status of JOB_STATUSES) {
      const q = queryFixture({ lastJob: { ...JOB, status } });
      expect(syncStatus(q).label.length).toBeGreaterThan(0);
    }
    expect(syncStatus(queryFixture({ lastJob: { ...JOB, status: "failed" } }))).toEqual({
      tone: "error",
      label: "Lỗi",
    });
  });

  it("BR-017: deleted, disabled and never-synced states have labels", () => {
    expect(syncStatus(queryFixture({ deletedAt: "2026-10-13T00:00:00.000Z" })).label).toBe("Đã xoá");
    expect(syncStatus(queryFixture({ enabled: false })).label).toBe("Tắt");
    expect(syncStatus(queryFixture({ lastJob: null })).label).toBe("Chưa đồng bộ");
    expect(
      syncStatus(
        queryFixture({ lastJob: null, lastError: { code: "X", message: "y", at: "2026-10-13T00:00:00.000Z" } }),
      ).label,
    ).toBe("Lỗi");
  });

  it("truncates long errors with an ellipsis and keeps short ones", () => {
    expect(truncateError("short")).toBe("short");
    const out = truncateError("a".repeat(100), 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith("…")).toBe(true);
  });

  it("formats poll interval and overlap durations", () => {
    expect(formatDuration(300)).toBe("5 phút");
    expect(formatDuration(5400)).toBe("1 giờ 30 phút");
    expect(formatDuration(45)).toBe("45 giây");
    expect(formatDuration(0)).toBe("0 giây");
  });
});

describe("syncErrorLabel (#42)", () => {
  it("names known codes in Vietnamese", () => {
    expect(syncErrorLabel("THREADS_RATE_LIMITED", "Threads rate limit reached (demo)")).toBe(
      "Threads giới hạn tần suất gọi",
    );
  });

  it("falls back to the truncated provider message for unknown codes", () => {
    expect(syncErrorLabel("SOMETHING_NEW", "x".repeat(80))).toHaveLength(60);
  });
});

describe("isStaleError (#342 flows-5)", () => {
  const err = { code: "X", message: "m", at: "2026-10-13T02:00:00.000Z" };
  it("stale only when a successful sync came after the error", () => {
    expect(isStaleError(queryFixture({ lastError: null }))).toBe(false);
    expect(isStaleError(queryFixture({ lastError: err, lastSuccessfulSyncAt: "2026-10-13T03:00:00.000Z" }))).toBe(true);
    expect(isStaleError(queryFixture({ lastError: err, lastSuccessfulSyncAt: "2026-10-13T01:00:00.000Z" }))).toBe(
      false,
    );
    expect(isStaleError(queryFixture({ lastError: err, lastSuccessfulSyncAt: null }))).toBe(false);
  });
});

describe("#340 helpers", () => {
  it("querySubline shows value · type, dropping a value that repeats the name", () => {
    expect(querySubline({ displayName: "Eventista show", queryType: "topic_tag", queryValue: "eventista" })).toBe(
      "#eventista · Chủ đề",
    );
    expect(querySubline({ displayName: "#Eventista", queryType: "topic_tag", queryValue: "eventista" })).toBe("Chủ đề");
  });

  it("mentionsWindowHref encodes the ISO window as a custom range", () => {
    expect(mentionsWindowHref("q1", "2026-10-01T00:00:00.000Z", "2026-10-02T00:00:00.000Z")).toBe(
      "/mentions?queryIds=q1&preset=custom&from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-02T00%3A00%3A00.000Z",
    );
  });

  it("isJobActive is true for queued/running on live queries only", () => {
    const q = queryFixture();
    if (!q.lastJob) throw new Error("fixture has a last job");
    expect(isJobActive(q)).toBe(false);
    expect(isJobActive({ ...q, lastJob: { ...q.lastJob, status: "running" } })).toBe(true);
    expect(
      isJobActive({ ...q, deletedAt: "2026-10-13T00:00:00.000Z", lastJob: { ...q.lastJob, status: "queued" } }),
    ).toBe(false);
  });
});
