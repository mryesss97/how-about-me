import { describe, expect, it } from "vitest";
import { viUpdated } from "./relative-time";

describe("viUpdated (#271, #336)", () => {
  const now = new Date("2026-10-14T05:00:00Z");
  it("relative under 24h, absolute dd/MM HH:mm in the timezone beyond", () => {
    expect(viUpdated("2026-10-14T04:59:50Z", now, "Asia/Ho_Chi_Minh")).toBe("vừa xong");
    expect(viUpdated("2026-10-14T04:55:00Z", now, "Asia/Ho_Chi_Minh")).toBe("5 phút trước");
    expect(viUpdated("2026-10-14T02:00:00Z", now, "Asia/Ho_Chi_Minh")).toBe("3 giờ trước");
    expect(viUpdated("2026-10-12T02:30:00Z", now, "Asia/Ho_Chi_Minh")).toBe("12/10 09:30");
  });
});
