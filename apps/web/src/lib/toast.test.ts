import { describe, expect, it, vi } from "vitest";

const error = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => error(...a) } }));

import { notifyError } from "./toast";

describe("notifyError (#348, BR-017)", () => {
  it("prefixes the visible word 'Lỗi' and passes options through", () => {
    notifyError("Không xuất được CSV.", { id: "t1", description: "Mã yêu cầu: r1" });
    expect(error).toHaveBeenCalledWith("Lỗi: Không xuất được CSV.", { id: "t1", description: "Mã yêu cầu: r1" });
  });
});
