import { INTENT_LABELS, LANGUAGE_CODES, TOPIC_LABELS } from "@how-about-me/taxonomy";
import { describe, expect, it } from "vitest";
import { displayLabel, intentLabelVi, languageLabelVi, topicLabelVi } from "./labels";

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
});
