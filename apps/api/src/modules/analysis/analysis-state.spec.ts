import { ANALYSIS_STATUSES } from "@how-about-me/contracts";
import { ANALYSIS_TRANSITIONS, assertTransition, canTransition } from "./analysis-state";

describe("analysis run state machine (FR-100, doc 07 §1)", () => {
  const allowed: [string, string][] = [
    ["pending", "processing"],
    ["pending", "stale"],
    ["processing", "completed"],
    ["processing", "skipped"],
    ["processing", "failed"],
    ["processing", "pending"],
    ["completed", "stale"],
    ["failed", "pending"],
  ];

  it("FR-100: allows exactly the documented transitions", () => {
    for (const from of ANALYSIS_STATUSES) {
      for (const to of ANALYSIS_STATUSES) {
        const expected = allowed.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });

  it("FR-100: skipped and stale are terminal", () => {
    expect(ANALYSIS_TRANSITIONS.skipped).toEqual([]);
    expect(ANALYSIS_TRANSITIONS.stale).toEqual([]);
  });

  it("FR-100: assertTransition throws INTERNAL on an invalid transition", () => {
    expect(() => assertTransition("completed", "processing")).toThrow(/completed → processing/);
    expect(() => assertTransition("pending", "processing")).not.toThrow();
  });
});
