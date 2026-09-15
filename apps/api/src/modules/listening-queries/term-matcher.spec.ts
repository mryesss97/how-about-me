import { evaluateTerms, isExcludedByTerms, normalizeForMatch } from "./term-matcher";

describe("evaluateTerms (BR-007, FR-059, FR-060)", () => {
  it("keeps a post when no terms are configured", () => {
    expect(evaluateTerms("vé 1Zone mở bán chưa?")).toEqual({
      excluded: false,
      reason: null,
      matchedExcludeTerm: null,
      matchedIncludeTerms: [],
    });
  });

  it("TC-LQ-016: an exclude term hides the post for that query and says which term did it", () => {
    const r = evaluateTerms("what time zone is 1zone streaming in?", [], ["time zone"]);
    expect(r.excluded).toBe(true);
    expect(r.reason).toBe("exclude_term");
    expect(r.matchedExcludeTerm).toBe("time zone");
  });

  it("TC-LQ-017: matching ignores case and accepts both Unicode compositions of Vietnamese text", () => {
    const term = "múi giờ";
    expect(evaluateTerms("MÚI GIỜ của show là gì?", [], [term]).excluded).toBe(true);
    expect(evaluateTerms("Múi Giờ của show là gì?".normalize("NFD"), [], [term]).excluded).toBe(true);
    expect(evaluateTerms("múi giờ nào vậy", [], [term.normalize("NFD")]).excluded).toBe(true);
  });

  it("keeps diacritics significant: an unaccented spelling does not match an accented term", () => {
    expect(evaluateTerms("mui gio cua show", [], ["múi giờ"]).excluded).toBe(false);
  });

  it("TC-LQ-018: with include terms configured, a post without any of them is excluded", () => {
    const r = evaluateTerms("concert 1Zone tối nay đông quá", ["vé"], []);
    expect(r.excluded).toBe(true);
    expect(r.reason).toBe("no_include_term_matched");
    expect(r.matchedExcludeTerm).toBeNull();
  });

  it("TC-LQ-018: a post containing an include term is kept and the matched terms are reported", () => {
    const r = evaluateTerms("còn vé VIP không shop, giá vé bao nhiêu?", ["vé", "giá"], []);
    expect(r.excluded).toBe(false);
    expect(r.matchedIncludeTerms).toEqual(["vé", "giá"]);
  });

  it("exclude wins over include when both would apply", () => {
    const r = evaluateTerms("vé máy bay đi Đà Lạt", ["vé"], ["vé máy bay"]);
    expect(r.excluded).toBe(true);
    expect(r.reason).toBe("exclude_term");
    expect(r.matchedIncludeTerms).toEqual([]);
  });

  it("substring matching is intentional: a term inside a longer word still matches", () => {
    expect(evaluateTerms("eventistaa", ["eventista"], []).excluded).toBe(false);
  });

  it("an empty or missing text is excluded only when include terms are required", () => {
    expect(evaluateTerms("", [], ["spam"]).excluded).toBe(false);
    expect(evaluateTerms(null, [], []).excluded).toBe(false);
    expect(evaluateTerms(undefined, ["vé"], []).excluded).toBe(true);
  });

  it("blank or whitespace-only terms are ignored, never excluding a whole query's traffic", () => {
    expect(evaluateTerms("bất kỳ nội dung nào", [], ["", "   "]).excluded).toBe(false);
    expect(evaluateTerms("bất kỳ nội dung nào", ["  "], []).excluded).toBe(false);
  });

  it("terms are trimmed before matching", () => {
    expect(evaluateTerms("giá vé quá cao", [], ["  giá vé  "]).excluded).toBe(true);
  });

  it("isExcludedByTerms is the flag-only shortcut used inside the ingestion transaction", () => {
    expect(isExcludedByTerms("what time zone is 1zone", [], ["time zone"])).toBe(true);
    expect(isExcludedByTerms("vé 1zone", ["vé"], ["time zone"])).toBe(false);
  });
});

describe("normalizeForMatch", () => {
  it("is idempotent and yields NFC lower-case", () => {
    const once = normalizeForMatch("MÚI GIỜ".normalize("NFD"));
    expect(once).toBe("múi giờ");
    expect(normalizeForMatch(once)).toBe(once);
    expect(once).toBe(once.normalize("NFC"));
  });
});
