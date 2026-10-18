import { INTEGRATION_STATUSES, JOB_STATUSES } from "@how-about-me/contracts";
import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  analysisStatusLabel,
  collectorStatusLabel,
  dayEndUtc,
  dayStartUtc,
  formatLag,
  integrationStatusLabel,
  jobStatusLabel,
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
