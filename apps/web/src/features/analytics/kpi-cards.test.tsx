import { OverviewResponseSchema } from "@how-about-me/contracts";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KpiCards } from "./kpi-cards";
import { overviewFixture } from "@/features/shared/overview-fixture.test-utils";

/** React Aria opens tooltips on keyboard focus; set keyboard modality first. */
async function focusTrigger(el: HTMLElement) {
  fireEvent.keyDown(document.body, { key: "Tab" });
  await act(async () => el.focus());
}

describe("KpiCards (FR-132)", () => {
  it("renders six cards", () => {
    render(<KpiCards kpis={overviewFixture().kpis} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
  });

  it("TC-DASH-006 / FR-140: info icon shows definition + denominator; sub-text shows denominator", async () => {
    render(<KpiCards kpis={overviewFixture().kpis} />);
    for (const label of [
      "Tổng lượt nhắc liên quan",
      "Tăng trưởng lượt nhắc",
      "Tỷ lệ tích cực",
      "Tỷ lệ tiêu cực",
      "Tỷ lệ nhạy cảm + nghiêm trọng",
      "Tỷ lệ phàn nàn",
    ]) {
      expect(screen.getByRole("button", { name: `Giải thích ${label}` })).toBeInTheDocument();
    }
    await focusTrigger(screen.getByRole("button", { name: "Giải thích Tỷ lệ tích cực" }));
    const tip = await screen.findByRole("tooltip");
    expect(within(tip).getByText(/cảm xúc = tích cực/)).toBeInTheDocument();
    expect(within(tip).getByText(/Mẫu số: lượt nhắc liên quan đã có nhãn cảm xúc/)).toBeInTheDocument();
    expect(screen.getAllByText("trên 2.410 đã phân tích").length).toBeGreaterThan(0);
  });

  it("TC-DASH-007 / FR-133: growthState new shows New, never ∞ or NaN", () => {
    const base = overviewFixture().kpis;
    render(
      <KpiCards kpis={{ ...base, mentionCount: { value: 12, previous: 0, growthPct: null, growthState: "new" } }} />,
    );
    expect(screen.getByText("Mới")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/∞|NaN|Infinity/);
  });

  it("#211 / FR-133: growthPct is percent — 105 vs 40 shows +162,5%, not +16250%", () => {
    // Payload as the API sends it (overview.math growth(105, 40)), parsed by the shared contract like api.ts does.
    const base = overviewFixture();
    const payload = OverviewResponseSchema.parse({
      ...base,
      kpis: { ...base.kpis, mentionCount: { value: 105, previous: 40, growthPct: 162.5, growthState: "up" } },
    });
    render(<KpiCards kpis={payload.kpis} />);
    expect(screen.getAllByText("+162,5%").length).toBeGreaterThan(0);
    expect(screen.queryByText(/16250/)).toBeNull();
  });

  it("TC-DASH-008 / BR-032: null rate with denominator 0 shows — with tooltip, not 0%", async () => {
    const base = overviewFixture().kpis;
    const empty = { value: null, numerator: 0, denominator: 0 };
    render(<KpiCards kpis={{ ...base, positiveRate: empty, negativeRate: empty }} />);
    const [first, ...rest] = screen.getAllByRole("button", { name: "Chưa có lượt nhắc đã phân tích trong khoảng này" });
    expect(rest).toHaveLength(1);
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.queryByText("0,0%")).toBeNull();
    await focusTrigger(first as HTMLElement);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Chưa có lượt nhắc đã phân tích trong khoảng này");
  });

  it("shows severe count only when > 0 (BR-017: safety is its own card)", () => {
    const base = overviewFixture().kpis;
    const { rerender } = render(<KpiCards kpis={base} />);
    expect(screen.queryByText(/^\d+ nghiêm trọng$/)).toBeNull();
    rerender(<KpiCards kpis={{ ...base, safetyRiskRate: { ...base.safetyRiskRate, severeCount: 3 } }} />);
    expect(screen.getByText("3 nghiêm trọng")).toBeInTheDocument();
  });

  it("rate delta in pp only when previous is returned (compare on)", () => {
    const base = overviewFixture().kpis;
    const { rerender } = render(<KpiCards kpis={base} />);
    expect(screen.queryByText(/điểm %$/)).toBeNull();
    rerender(<KpiCards kpis={{ ...base, negativeRate: { ...base.negativeRate, previous: 0.179 } }} />);
    expect(screen.getByText("+2,1 điểm %")).toBeInTheDocument();
  });

  it("TC-DASH-018 / FR-142: each card links to /mentions with its drill-down filter; severe line has its own link", () => {
    const hrefFor = (id: string) => `/mentions?kpi=${id}`;
    const base = overviewFixture().kpis;
    const kpis = { ...base, safetyRiskRate: { ...base.safetyRiskRate, severeCount: 3 } };
    render(<KpiCards kpis={kpis} hrefFor={hrefFor} />);
    for (const [label, id] of [
      ["Tổng lượt nhắc liên quan", "mentions"],
      ["Tăng trưởng lượt nhắc", "growth"],
      ["Tỷ lệ tích cực", "positive"],
      ["Tỷ lệ tiêu cực", "negative"],
      ["Tỷ lệ nhạy cảm + nghiêm trọng", "safety"],
      ["Tỷ lệ phàn nàn", "complaint"],
    ]) {
      expect(screen.getByRole("link", { name: `Xem lượt nhắc: ${label}` })).toHaveAttribute(
        "href",
        `/mentions?kpi=${id}`,
      );
    }
    expect(screen.getByRole("link", { name: "3 nghiêm trọng" })).toHaveAttribute("href", "/mentions?kpi=severe");
  });

  it("#275: arrows are icons, never ↑/↓ glyphs; cards are enamel boards without shadow", () => {
    const { container } = render(<KpiCards kpis={overviewFixture().kpis} />);
    expect(container.textContent).not.toMatch(/[↑↓]/);
    const card = screen.getByRole("heading", { name: "Tỷ lệ tích cực" }).closest(".operate-board");
    expect(card).not.toBeNull();
    expect(card?.className).not.toMatch(/shadow|rounded-full/);
  });

  it("BR-017: only sentiment figures are tinted; the safety figure stays ink", () => {
    render(<KpiCards kpis={overviewFixture().kpis} />);
    const figureOf = (label: string) =>
      screen.getByRole("heading", { name: label }).closest(".operate-board")?.querySelector(".kpi-figure");
    expect(figureOf("Tỷ lệ tích cực")?.className).toContain("--green-enamel");
    expect(figureOf("Tỷ lệ tiêu cực")?.className).toContain("--red-enamel");
    expect(figureOf("Tỷ lệ nhạy cảm + nghiêm trọng")?.className).toContain("--ink");
  });

  it("without hrefFor, cards are not links", () => {
    render(<KpiCards kpis={overviewFixture().kpis} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
