import { INTEGRATION_STATUSES, JOB_STATUSES } from "@how-about-me/contracts";
import { describe, expect, it } from "vitest";
import { jobStatusLabelVi } from "@/lib/semantics/labels";
import {
  activeFilterCount,
  analysisStatusLabel,
  collectorStatusLabel,
  dayEndUtc,
  dayStartUtc,
  formatLag,
  integrationStatusLabel,
  auditActionLabel,
  jobStatusLabel,
  jobTriggerLabel,
} from "./format";

describe("system-status format", () => {
  it("formatLag", () => {
    expect(formatLag(null)).toBe("—");
    expect(formatLag(45)).toBe("45 giây");
    expect(formatLag(720)).toBe("12 phút");
    expect(formatLag(3 * 3600 + 5)).toBe("3 giờ");
  });

  it("BR-017: every status enum has a non-empty text label", () => {
    for (const s of JOB_STATUSES) expect(jobStatusLabel[s].label).toBeTruthy();
    for (const s of INTEGRATION_STATUSES) expect(integrationStatusLabel[s].label).toBeTruthy();
    for (const l of [...Object.values(collectorStatusLabel), ...Object.values(analysisStatusLabel)])
      expect(l.label).toBeTruthy();
    expect(integrationStatusLabel.expired.tone).toBe("error");
  });

  it("day bounds are computed in the project timezone and returned as UTC", () => {
    expect(dayStartUtc("2026-10-13", "Asia/Ho_Chi_Minh")).toBe("2026-10-12T17:00:00.000Z");
    expect(dayEndUtc("2026-10-13", "Asia/Ho_Chi_Minh")).toBe("2026-10-13T16:59:59.999Z");
  });

  it("#343: activeFilterCount counts non-empty fields", () => {
    expect(activeFilterCount({ queryId: "q", status: "", from: "2026-10-01", to: "" })).toBe(2);
    expect(activeFilterCount({})).toBe(0);
  });
});

describe("#344 one vocabulary", () => {
  it("BR-017: job status labels come from the shared map (same word as Listening Queries)", () => {
    for (const s of JOB_STATUSES) expect(jobStatusLabel[s].label).toBe(jobStatusLabelVi[s]);
    expect(jobStatusLabel.failed.label).toBe("Lỗi");
  });
  it("backfill and override wording matches the action screens", () => {
    expect(jobTriggerLabel.backfill).toBe("Lấy dữ liệu cũ");
    expect(auditActionLabel["query.backfill_requested"]).toBe("Yêu cầu lấy dữ liệu cũ");
    expect(auditActionLabel["override.created"]).toBe("Ghi đè");
    expect(auditActionLabel["override.revoked"]).toBe("Thu hồi ghi đè");
    expect(auditActionLabel["mentions.exported"]).toBe("Xuất CSV bài nhắc");
  });
});
