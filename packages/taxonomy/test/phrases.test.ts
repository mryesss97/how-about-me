import { describe, expect, it } from "vitest";
import { MAX_PHRASES_PER_POST, normalizePhrase, normalizePhrases } from "../src/index.js";

// BR-041: key phrase normalisation.
describe("normalizePhrase (BR-041)", () => {
  it("composes NFC", () => {
    const decomposed = "giá vé";
    expect(normalizePhrase(decomposed)).toBe("giá vé");
    expect(normalizePhrase(decomposed)).toBe("giá vé".normalize("NFC"));
  });
  it("lowercases, trims and collapses whitespace", () => {
    expect(normalizePhrase("  Giá   Vé \t")).toBe("giá vé");
  });
  it("strips quotes and punctuation at both ends, keeps inner hyphen", () => {
    expect(normalizePhrase('"Check-in!"')).toBe("check-in");
    expect(normalizePhrase("#ĐỈNH QUÁ!!!")).toBe("đỉnh quá");
    expect(normalizePhrase("“app lỗi”.")).toBe("app lỗi");
  });
  it("turns comma, semicolon, pipe and newline into spaces", () => {
    expect(normalizePhrase("giá,vé")).toBe("giá vé");
    expect(normalizePhrase("a;b|c\nd")).toBe("a b c d");
  });
  it("returns null for empty, emoji-only, punctuation-only or too long", () => {
    expect(normalizePhrase("")).toBeNull();
    expect(normalizePhrase("   ")).toBeNull();
    expect(normalizePhrase("🔥🔥")).toBeNull();
    expect(normalizePhrase("!!!")).toBeNull();
    expect(normalizePhrase("a".repeat(61))).toBeNull();
    expect(normalizePhrase("a".repeat(60))).toBe("a".repeat(60));
  });
  it("does not strip Vietnamese accents: 'gia ve' and 'giá vé' stay different", () => {
    expect(normalizePhrase("gia ve")).toBe("gia ve");
    expect(normalizePhrase("gia ve")).not.toBe(normalizePhrase("giá vé"));
  });
});

describe("normalizePhrases (BR-041)", () => {
  it("dedupes after normalisation keeping first-occurrence order", () => {
    expect(normalizePhrases(["Giá vé", "giá vé ", "app lỗi", "🔥"])).toEqual(["giá vé", "app lỗi"]);
  });
  it("caps at MAX_PHRASES_PER_POST", () => {
    expect(MAX_PHRASES_PER_POST).toBe(5);
    expect(normalizePhrases(["a", "b", "c", "d", "e", "f"])).toEqual(["a", "b", "c", "d", "e"]);
  });
});
