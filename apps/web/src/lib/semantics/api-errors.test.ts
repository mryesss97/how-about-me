import { ERROR_CODES } from "@how-about-me/contracts";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { apiErrorMessageVi, toQueryStateError } from "./api-errors";

describe("apiErrorMessageVi (#392)", () => {
  it("every contract ErrorCode has Vietnamese copy that is not the code itself", () => {
    for (const code of Object.keys(ERROR_CODES)) {
      const msg = apiErrorMessageVi({ code });
      expect(msg, code).toBeTruthy();
      expect(msg, code).not.toBe(code);
      expect(msg, code).not.toBe("Đã xảy ra lỗi. Thử lại sau giây lát.");
    }
  });

  it("client-only, unknown and missing codes", () => {
    expect(apiErrorMessageVi({ code: "NETWORK_ERROR" })).toBe("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
    expect(apiErrorMessageVi({ code: "UNKNOWN" })).toBe("Máy chủ tạm thời không phản hồi. Thử lại sau ít phút.");
    expect(apiErrorMessageVi({ code: "WHAT" })).toBe("Đã xảy ra lỗi. Thử lại sau giây lát.");
    expect(apiErrorMessageVi({})).toBe("Phản hồi không hợp lệ từ máy chủ.");
    expect(apiErrorMessageVi(null)).toBe("Phản hồi không hợp lệ từ máy chủ.");
  });

  it("never returns the original message", () => {
    expect(apiErrorMessageVi(new ApiError(500, "INTERNAL", "Internal server error"))).not.toContain("Internal");
    expect(apiErrorMessageVi({ code: "NOPE", message: "raw" })).not.toContain("raw");
  });

  it("toQueryStateError maps ApiError, parse errors and null", () => {
    expect(toQueryStateError(null)).toBeNull();
    expect(toQueryStateError(new ApiError(500, "INTERNAL", "x", "r1"))).toEqual({
      code: "INTERNAL",
      message: "x",
      requestId: "r1",
    });
    expect(toQueryStateError(new Error("zod"))).toEqual({ message: "Phản hồi không hợp lệ từ máy chủ." });
  });
});
