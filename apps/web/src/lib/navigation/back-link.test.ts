import { describe, expect, it } from "vitest";
import { resolveBack, withBack } from "./back-link";

// #331: back link follows the source page
describe("resolveBack", () => {
  it("labels a phrase page and decodes the term", () => {
    expect(resolveBack("/terms/v%C3%A9?preset=30d")).toEqual({
      href: "/terms/v%C3%A9?preset=30d",
      label: 'Về cụm từ "vé"',
    });
  });
  it("labels system status, reviews and mentions", () => {
    expect(resolveBack("/system-status")?.label).toBe("Về Lỗi phân tích");
    expect(resolveBack("/reviews?x=1")?.label).toBe("Về Cần xem lại");
    expect(resolveBack("/mentions?preset=7d")?.label).toBe("Quay lại danh sách");
  });
  it.each(["//evil.com", "https://evil.com", "/\\evil", "/settings", "/terms/", "", null])("rejects %s", (raw) => {
    expect(resolveBack(raw)).toBeNull();
  });
  it("withBack appends an encoded back param", () => {
    const url = new URL(withBack("/mentions/1", "/terms/vé?preset=30d"), "http://x");
    expect(url.searchParams.get("back")).toBe("/terms/vé?preset=30d");
  });
});
