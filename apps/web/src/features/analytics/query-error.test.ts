import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { toQueryError } from "./query-error";

describe("toQueryError (#252)", () => {
  it("returns null when there is no error", () => {
    expect(toQueryError(null)).toBeNull();
  });

  it("maps ApiError to the error envelope fields", () => {
    expect(toQueryError(new ApiError(500, "UNKNOWN", "boom", "req-1"))).toEqual({
      code: "UNKNOWN",
      message: "boom",
      requestId: "req-1",
    });
  });

  it("uses a generic message for other errors", () => {
    expect(toQueryError(new Error("x"))).toEqual({ message: "Phản hồi không hợp lệ từ máy chủ." });
  });
});
