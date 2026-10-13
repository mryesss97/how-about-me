import { DatasetError, parseDataset } from "./dataset";

const line = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ id: "ev-1", text: "t", labels: { relevance: "relevant", safetyLevel: "safe" }, ...over });

describe("parseDataset (T-079)", () => {
  it("parses valid lines, skips blank lines and defaults matchedTerms", () => {
    const items = parseDataset(`${line()}\n\n${line({ id: "ev-2" })}\n`);
    expect(items.map((i) => i.id)).toEqual(["ev-1", "ev-2"]);
    expect(items[0]?.matchedTerms).toEqual([]);
  });

  it("reports the line number on invalid JSON", () => {
    expect(() => parseDataset(`${line()}\n{oops`)).toThrow(/line 2: invalid JSON/);
  });

  it("rejects unknown labels with line and id (FR-119)", () => {
    const bad = line({ id: "ev-9", labels: { relevance: "maybe", safetyLevel: "safe" } });
    expect(() => parseDataset(bad)).toThrow(DatasetError);
    expect(() => parseDataset(bad)).toThrow(/line 1 \(id ev-9\).*labels\.relevance/);
  });

  it("rejects duplicate ids", () => {
    expect(() => parseDataset(`${line()}\n${line()}`)).toThrow(/line 2: duplicate id ev-1/);
  });

  it("rejects an empty dataset", () => {
    expect(() => parseDataset("\n\n")).toThrow(/empty/);
  });
});
