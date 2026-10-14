import { INTENT_LABELS, LANGUAGE_CODES, TOPIC_LABELS } from "@how-about-me/taxonomy";
import { describe, expect, it } from "vitest";
import { displayLabel, intentLabelVi, languageLabelVi, reviewReasonLabelVi, roleLabelVi, topicLabelVi } from "./labels";

describe("Vietnamese taxonomy labels (#275)", () => {
  it("covers every intent, topic and language value", () => {
    for (const v of INTENT_LABELS) expect(intentLabelVi[v]).toBeTruthy();
    for (const v of TOPIC_LABELS) expect(topicLabelVi[v]).toBeTruthy();
    for (const v of LANGUAGE_CODES) expect(languageLabelVi[v]).toBeTruthy();
  });

  it("BR-017: sentiment and safety keep separate labels", () => {
    expect(displayLabel("sentiment", "negative")).toBe("Tiêu cực");
    expect(displayLabel("safety", "severe")).toBe("Nghiêm trọng");
  });

  it("falls back to a humanised value for unknown keys", () => {
    expect(displayLabel("topic", "new_thing")).toBe("New thing");
    expect(displayLabel("intent", "purchase_intent")).toBe("Ý định mua");
  });

  it("#278 FR-195: every review reason has a Vietnamese label", () => {
    for (const v of ["uncertain", "low_confidence", "failed"] as const) expect(reviewReasonLabelVi[v]).toBeTruthy();
    expect(displayLabel("reviewReason", "failed")).toBe("Phân tích lỗi");
  });
});

describe("roleLabelVi (#281)", () => {
  it("labels every role in Vietnamese, keyed by the API enum", () => {
    expect(roleLabelVi).toEqual({ admin: "Quản trị", analyst: "Phân tích", viewer: "Chỉ xem" });
  });
});
