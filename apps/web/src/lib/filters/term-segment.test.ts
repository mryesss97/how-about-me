import { describe, expect, it } from "vitest";
import { parseTermSegment } from "./term-segment";

// #276: route segment of /terms/[term] (BR-041 normalisation; invalid → not found)
describe("parseTermSegment", () => {
  it("decodes and normalises", () => {
    expect(parseTermSegment("gi%C3%A1%20v%C3%A9")).toBe("giá vé");
    expect(parseTermSegment("Giá  Vé")).toBe("giá vé");
    expect(parseTermSegment("50%")).toBe("50%");
  });
  it("invalid → null", () => {
    for (const bad of ["", "%20", "!!!", "a".repeat(61)]) expect(parseTermSegment(bad)).toBeNull();
  });
});
