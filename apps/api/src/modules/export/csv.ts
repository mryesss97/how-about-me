/** Minimal RFC 4180 CSV serializer (T-147, FR-180) — no dependency needed. */

/** UTF-8 BOM so Excel detects UTF-8 (Vietnamese text). */
export const CSV_BOM = "\uFEFF";
export const CSV_EOL = "\r\n";

/** OWASP CSV injection: cells starting with these may be evaluated as formulas by spreadsheets. */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | null | undefined, opts?: { guardFormula?: boolean }): string {
  if (value == null) return "";
  let v = value;
  if (opts?.guardFormula && FORMULA_START.test(v)) v = `'${v}`;
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Cells must already be escaped via `csvCell`. */
export function csvRow(cells: string[]): string {
  return cells.join(",") + CSV_EOL;
}
