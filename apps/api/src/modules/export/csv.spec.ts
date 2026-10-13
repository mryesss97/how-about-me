import { CSV_BOM, CSV_EOL, csvCell, csvRow } from "./csv";

/** TC-EXP-005 / FR-180: RFC 4180 escaping, UTF-8, formula guard. */
describe("csv", () => {
  it("quotes commas, quotes and newlines (RFC 4180)", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('Giá vé "đắt"')).toBe('"Giá vé ""đắt"""');
    expect(csvCell("x\ny")).toBe('"x\ny"');
    expect(csvCell("x\r\ny")).toBe('"x\r\ny"');
  });

  it("keeps Vietnamese text as-is and null → empty", () => {
    expect(csvCell("Giá vé quá đắt")).toBe("Giá vé quá đắt");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tx"])("guards formula start %j", (v) => {
    expect(csvCell(v, { guardFormula: true }).replace(/^"/, "")).toMatch(/^'/);
    expect(csvCell(v)).not.toMatch(/^'/);
  });

  it("does not alter normal strings when guarding", () => {
    expect(csvCell("hello", { guardFormula: true })).toBe("hello");
  });

  it("rows end with CRLF; BOM is U+FEFF", () => {
    expect(csvRow(["a", "b"])).toBe(`a,b${CSV_EOL}`);
    expect(CSV_EOL).toBe("\r\n");
    expect(CSV_BOM.charCodeAt(0)).toBe(0xfeff);
  });
});
