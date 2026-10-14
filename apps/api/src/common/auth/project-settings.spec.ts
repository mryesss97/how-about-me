import { parseProjectSettings } from "./project-settings";

const DEFAULTS = { allowAnalystReanalyze: true, allowViewerExport: false, phraseMinMentions: 2 };

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
});
