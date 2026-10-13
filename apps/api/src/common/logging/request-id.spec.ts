import { resolveRequestId } from "./request-id";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("resolveRequestId (FR-173)", () => {
  it("keeps a safe client id", () => {
    expect(resolveRequestId("abc-123.x:y_z")).toBe("abc-123.x:y_z");
  });

  it.each([
    ["too long", "a".repeat(129)],
    ["CRLF injection", "abc\r\nx-evil: 1"],
    ["spaces", "a b"],
    ["empty", ""],
    ["array", ["a", "b"]],
    ["undefined", undefined],
  ])("replaces %s with a fresh uuid v7", (_label, header) => {
    expect(resolveRequestId(header)).toMatch(UUID_V7);
  });
});
