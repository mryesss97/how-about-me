import { describe, expect, it } from "vitest";
import { highlightSegments } from "./highlight";

const matches = (t: string, q: string) =>
  highlightSegments(t, q)
    .filter((s) => s.match)
    .map((s) => s.text);

describe("highlightSegments (FR-158)", () => {
  it("is case-insensitive", () => expect(matches("Giá VÉ tăng, giá vé", "giá vé")).toEqual(["Giá", "VÉ", "giá", "vé"]));
  it("matches Vietnamese text written in NFD form", () =>
    expect(matches("Giá vé".normalize("NFD"), "giá")).toEqual(["Giá"]));
  it("escapes regex characters in q", () => expect(matches("a (b) c.*", "(b) .*")).toEqual(["(b)", ".*"]));
  it("empty q → single plain segment", () =>
    expect(highlightSegments("hello", "  ")).toEqual([{ text: "hello", match: false }]));
});
