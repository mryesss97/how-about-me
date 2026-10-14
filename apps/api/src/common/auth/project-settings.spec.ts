import { parseProjectSettings } from "./project-settings";

const DEFAULTS = { allowAnalystReanalyze: true, allowViewerExport: false, phraseMinMentions: 2, landingTerms: [] };

describe("parseProjectSettings (FR-032, #251)", () => {
  it("fills defaults for missing keys and non-objects", () => {
    expect(parseProjectSettings({})).toEqual(DEFAULTS);
    expect(parseProjectSettings(null)).toEqual(DEFAULTS);
    expect(parseProjectSettings("x")).toEqual(DEFAULTS);
    expect(parseProjectSettings([1])).toEqual(DEFAULTS);
  });

  it.each([0, 51, "5", null, 2.5])("phraseMinMentions %p falls back to 2 and keeps valid toggles", (bad) => {
    expect(parseProjectSettings({ allowViewerExport: true, phraseMinMentions: bad })).toEqual({
      ...DEFAULTS,
      allowViewerExport: true,
    });
  });

  it("a bad toggle does not reset a valid phraseMinMentions", () => {
    expect(parseProjectSettings({ allowViewerExport: "yes", phraseMinMentions: 7 })).toEqual({
      ...DEFAULTS,
      phraseMinMentions: 7,
    });
  });

  it.each(["x", [1], Array.from({ length: 21 }, (_, i) => `t${i}`)])(
    "BR-042 (#261): malformed landingTerms %p falls back to [] and keeps other keys",
    (bad) => {
      expect(parseProjectSettings({ phraseMinMentions: 7, landingTerms: bad })).toEqual({
        ...DEFAULTS,
        phraseMinMentions: 7,
      });
    },
  );
});
