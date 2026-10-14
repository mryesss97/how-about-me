import type { LanguagesDistributionResponse } from "@how-about-me/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageDistributionChart } from "./language-distribution-chart";
import { openTable } from "./table-utils.test-utils";

const fixture = (patch: Partial<LanguagesDistributionResponse> = {}): LanguagesDistributionResponse => ({
  denominator: 100,
  distribution: [
    { label: "vi", count: 70, share: 0.7 },
    { label: "en", count: 20, share: 0.2 },
    { label: "unknown", count: 6, share: 0.06 },
    { label: "other", count: 4, share: 0.04 },
    { label: "ko", count: 0, share: 0 },
    { label: "ja", count: 0, share: 0 },
    { label: "th", count: 0, share: 0 },
    { label: "zh", count: 0, share: 0 },
  ],
  ...patch,
});

describe("LanguageDistributionChart", () => {
  it("TC-DASH-027 / FR-143: table lists all 8 codes in API order + Total = denominator", async () => {
    render(<LanguageDistributionChart data={fixture()} />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Ngôn ngữ", "Số lượng", "Tỷ lệ"]);
    expect(rows.map((r) => r[0])).toEqual([
      "Tiếng Việt",
      "Tiếng Anh",
      "Không xác định",
      "Khác",
      "Tiếng Hàn",
      "Tiếng Nhật",
      "Tiếng Thái",
      "Tiếng Trung",
      "Tổng",
    ]);
    const sum = rows.slice(0, 8).reduce((s, r) => s + Number(r[1]), 0);
    expect(rows[8]?.[1]).toBe(String(sum));
    expect(rows[8]?.[1]).toBe("100");
  });

  it("NFR-030: legend shows only non-zero languages with share text", () => {
    render(<LanguageDistributionChart data={fixture()} />);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["Tiếng Việt · 70,0%", "Tiếng Anh · 20,0%", "Không xác định · 6,0%", "Khác · 4,0%"]);
  });

  it("BR-032: denominator 0 → empty state", () => {
    render(
      <LanguageDistributionChart
        data={fixture({
          denominator: 0,
          distribution: fixture().distribution.map((d) => ({ ...d, count: 0, share: null })),
        })}
      />,
    );
    expect(screen.getByText("Chưa có lượt nhắc nhận diện được ngôn ngữ trong khoảng này")).toBeInTheDocument();
  });

  it("error state shows request ID and Retry", () => {
    const onRetry = vi.fn();
    render(
      <LanguageDistributionChart error={{ code: "INTERNAL", message: "boom", requestId: "req-7" }} onRetry={onRetry} />,
    );
    expect(screen.getByText(/req-7/)).toBeInTheDocument();
    screen.getByRole("button", { name: /thử lại/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });
});
