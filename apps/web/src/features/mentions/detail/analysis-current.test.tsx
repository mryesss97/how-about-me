import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisCurrent } from "./analysis-current";
import { detailFixture, overrideFixture } from "./fixtures.test-utils";

const TZ = "Asia/Ho_Chi_Minh";

describe("AnalysisCurrent", () => {
  it("expands safety category scores and marks triggered rows with their level (TC-MEN-010)", () => {
    const m = detailFixture({
      analysis: {
        safety: { level: "sensitive" },
        safetyCategoryScores: { harassment: 0.81234, violence: 0.1 },
        safetyTriggered: [{ category: "harassment", score: 0.81234, level: "sensitive" }],
      },
    });
    render(<AnalysisCurrent mention={m} tz={TZ} />);
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hiện điểm theo hạng mục" }));
    const rows = within(screen.getByRole("table", { name: "Điểm an toàn theo hạng mục" })).getAllByRole("row");
    expect(rows[1]).toHaveAttribute("data-triggered", "true");
    expect(rows[1]).toHaveTextContent("Harassment0,812Nhạy cảm");
    expect(rows[2]).not.toHaveAttribute("data-triggered");
  });

  it("lists the 7 version fields and analyzedAt (TC-MEN-011)", () => {
    const m = detailFixture({
      analysis: {
        versions: {
          classifierProvider: "openai",
          classifierModel: "gpt-x",
          promptVersion: "p3",
          taxonomyVersion: "t2",
          safetyProvider: "openai",
          safetyModel: "omni-mod",
          safetyPolicyVersion: "s1",
        },
      },
    });
    render(<AnalysisCurrent mention={m} tz={TZ} />);
    // #338: technical details are folded by default and not in the DOM.
    const toggle = screen.getByRole("button", { name: "Chi tiết kỹ thuật" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("gpt-x")).toBeNull();
    expect(screen.queryByText("Phân tích lúc")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    for (const v of ["gpt-x", "p3", "t2", "omni-mod", "s1"]) expect(screen.getByText(v)).toBeInTheDocument();
    expect(screen.getAllByText("openai")).toHaveLength(2);
    expect(screen.getByText("Phân tích lúc")).toBeInTheDocument();
  });

  // TC-REV-001 / FR-194 / BR-025
  it("overridden field shows the Analyst badge, struck-through AI value and no confidence", () => {
    const m = detailFixture({
      analysis: { sentiment: { label: "neutral", confidence: 0.8 }, overallConfidence: 0.5 },
      overrides: [overrideFixture()],
    });
    const { container } = render(<AnalysisCurrent mention={m} tz={TZ} />);
    expect(screen.getByText("Chuyên viên")).toBeInTheDocument();
    const struck = container.querySelector("s");
    expect(struck).toHaveTextContent("Tiêu cực");
    expect(struck).toHaveClass("line-through");
    expect(screen.getByText("Giá trị AI: Tiêu cực")).toBeInTheDocument();
    expect(screen.getByTestId("analyst-source")).toHaveAttribute("title", expect.stringContaining("Ana Analyst"));
    expect(screen.getByTestId("analyst-source")).toHaveAttribute("title", expect.stringContaining("Sarcasm"));
    // Relevance is still AI and keeps its confidence.
    expect(screen.getAllByText("AI").length).toBeGreaterThan(0);
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.queryByText("80%")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Chi tiết kỹ thuật" }));
    expect(screen.getByText(/là giá trị AI, không phải ghi đè của chuyên viên/)).toBeInTheDocument();
  });

  it("revoked override is ignored → AI badge only (FR-193)", () => {
    const m = detailFixture({ overrides: [overrideFixture({ revokedAt: "2026-10-13T06:00:00.000Z" })] });
    render(<AnalysisCurrent mention={m} tz={TZ} />);
    expect(screen.queryByText("Chuyên viên")).toBeNull();
    expect(screen.getAllByText("AI").length).toBeGreaterThan(0);
  });

  it("AI value missing at override time shows a dash", () => {
    const m = detailFixture({ overrides: [overrideFixture({ previousValue: null })] });
    render(<AnalysisCurrent mention={m} tz={TZ} />);
    expect(screen.getByText("Giá trị AI: —")).toBeInTheDocument();
  });

  it("Revoke only with canOverride; confirm calls onRevoke (FR-193)", () => {
    const m = detailFixture({ overrides: [overrideFixture()] });
    const { unmount } = render(<AnalysisCurrent mention={m} tz={TZ} />);
    expect(screen.queryByRole("button", { name: "Thu hồi" })).toBeNull();
    unmount();
    const onRevoke = vi.fn();
    render(<AnalysisCurrent mention={m} tz={TZ} canOverride onRevoke={onRevoke} />);
    fireEvent.click(screen.getByRole("button", { name: "Thu hồi" }));
    fireEvent.click(screen.getByRole("button", { name: "Thu hồi ghi đè" }));
    expect(onRevoke).toHaveBeenCalledWith(overrideFixture().id);
  });

  it("overridden intents drop the per-chip confidence", () => {
    const m = detailFixture({
      analysis: { intents: [{ label: "complaint", confidence: null }] },
      overrides: [overrideFixture({ field: "intents", previousValue: ["praise"], value: ["complaint"] })],
    });
    render(<AnalysisCurrent mention={m} tz={TZ} />);
    expect(screen.getByText("Phàn nàn")).toBeInTheDocument();
    expect(screen.getByText("Giá trị AI: Khen ngợi")).toBeInTheDocument();
  });

  describe("#338 verdict first, per-field Sửa, previous-run note", () => {
    it("Kết luận comes before Nội dung and holds relevance, sentiment and safety", () => {
      render(<AnalysisCurrent mention={detailFixture()} tz={TZ} />);
      const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
      expect(headings.indexOf("Kết luận")).toBeLessThan(headings.indexOf("Nội dung"));
      const verdict = within(screen.getByRole("region", { name: "Kết luận" }));
      for (const l of ["Mức liên quan", "Cảm xúc", "An toàn"])
        expect(verdict.getAllByText(l).length).toBeGreaterThan(0);
      expect(verdict.queryByText("Ý định")).toBeNull();
    });

    it("FR-191: Sửa on the 5 overridable fields calls onEditField; none on Cụm từ khoá", () => {
      const onEditField = vi.fn();
      render(<AnalysisCurrent mention={detailFixture()} tz={TZ} canOverride onEditField={onEditField} />);
      for (const f of ["Mức liên quan", "Cảm xúc", "Mức an toàn", "Ý định", "Chủ đề"])
        expect(screen.getByRole("button", { name: `Sửa ${f}` })).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /^Sửa/ })).toHaveLength(5);
      fireEvent.click(screen.getByRole("button", { name: "Sửa Cảm xúc" }));
      expect(onEditField).toHaveBeenCalledWith("sentiment");
    });

    it("FR-015 / BR-033: no Sửa without canOverride", () => {
      render(<AnalysisCurrent mention={detailFixture()} tz={TZ} canOverride={false} onEditField={vi.fn()} />);
      expect(screen.queryByRole("button", { name: /^Sửa/ })).toBeNull();
    });

    it("failed run with earlier values shows the previous-run note; completed does not", () => {
      const { unmount } = render(
        <AnalysisCurrent
          mention={detailFixture({ analysis: { status: "failed", analyzedAt: "2026-10-12T03:00:00.000Z" } })}
          tz={TZ}
        />,
      );
      expect(screen.getByText(/từ lần phân tích trước/)).toBeInTheDocument();
      unmount();
      render(<AnalysisCurrent mention={detailFixture()} tz={TZ} />);
      expect(screen.queryByText(/từ lần phân tích trước/)).toBeNull();
    });
  });

  describe("key phrases (#250, FR-120, BR-041)", () => {
    const versions = detailFixture().analysis.versions ?? {
      classifierProvider: "openai",
      classifierModel: "gpt-x",
      promptVersion: "classifier-v2",
      taxonomyVersion: "t2",
      safetyProvider: "openai",
      safetyModel: "omni-mod",
      safetyPolicyVersion: "s1",
    };
    const V1_TEXT = "Chưa có cụm từ (phân tích trước khi có trích xuất cụm từ)";

    it("renders phrases in order as links to /mentions?phrase= only", () => {
      render(
        <AnalysisCurrent
          mention={detailFixture({ analysis: { versions, phrases: ["giá vé", "check-in"] } })}
          tz={TZ}
        />,
      );
      const links = screen.getAllByRole("link", { name: /Xem bài nhắc có cụm từ/ });
      expect(links.map((l) => l.textContent)).toEqual(["giá vé", "check-in"]);
      const url = new URL(links[0]?.getAttribute("href") ?? "", "http://x");
      expect(url.pathname).toBe("/mentions");
      expect(url.searchParams.get("phrase")).toBe("giá vé");
      expect([...url.searchParams.keys()]).toEqual(["phrase"]);
    });

    it("shows the v1 text when phrases is null or missing on an analysed mention", () => {
      const { unmount } = render(
        <AnalysisCurrent mention={detailFixture({ analysis: { versions, phrases: null } })} tz={TZ} />,
      );
      expect(screen.getByText(V1_TEXT)).toBeInTheDocument();
      unmount();
      render(<AnalysisCurrent mention={detailFixture({ analysis: { versions, phrases: undefined } })} tz={TZ} />);
      expect(screen.getByText(V1_TEXT)).toBeInTheDocument();
    });

    it("shows a dash for v2 without phrases", () => {
      render(<AnalysisCurrent mention={detailFixture({ analysis: { versions, phrases: [] } })} tz={TZ} />);
      expect(screen.queryByRole("link", { name: /Xem bài nhắc có cụm từ/ })).toBeNull();
      expect(screen.queryByText(V1_TEXT)).toBeNull();
    });

    it("does not show the v1 text when not analysed", () => {
      render(<AnalysisCurrent mention={detailFixture({ analysis: { versions: null, phrases: null } })} tz={TZ} />);
      expect(screen.queryByText(V1_TEXT)).toBeNull();
    });
  });
});
