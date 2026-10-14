import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ANALYSIS_STATUSES, CONFIDENCE_BAND_VALUES } from "@how-about-me/contracts";
import { RELEVANCE_LABELS, SAFETY_LEVELS, SENTIMENT_LABELS } from "@how-about-me/taxonomy";
import {
  AnalysisStatusBadge,
  ConfidenceMarker,
  RelevanceBadge,
  SafetyBadge,
  SentimentBadge,
  ValueSourceBadge,
} from "./semantic-badge";

describe("semantic badges (UX §2.2, NFR-035)", () => {
  it("renders a readable text label for every sentiment, safety and relevance value", () => {
    const { container } = render(
      <>
        {SENTIMENT_LABELS.map((v) => (
          <SentimentBadge key={v} value={v} />
        ))}
        {SAFETY_LEVELS.map((v) => (
          <SafetyBadge key={v} value={v} />
        ))}
        {RELEVANCE_LABELS.map((v) => (
          <RelevanceBadge key={v} value={v} />
        ))}
      </>,
    );
    for (const label of [
      "Tích cực",
      "Trung tính",
      "Tiêu cực",
      "An toàn",
      "Nhạy cảm",
      "Nghiêm trọng",
      "Liên quan",
      "Chưa chắc",
      "Không liên quan",
    ])
      expect(screen.getByText(label)).toBeInTheDocument();
    // Colour is never the only encoding: each badge carries an icon alongside the label.
    expect(container.querySelectorAll("svg").length).toBe(9);
  });

  it("covers every analysis status, so a mention row never renders a blank cell", () => {
    render(
      <>
        {ANALYSIS_STATUSES.map((v) => (
          <AnalysisStatusBadge key={v} value={v} />
        ))}
      </>,
    );
    for (const label of ["Chờ phân tích", "Đang phân tích…", "Đã phân tích", "Phân tích lỗi", "Bỏ qua", "Cũ"])
      expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("BR-021: only medium and low confidence are marked — high stays silent", () => {
    const { container: high } = render(<ConfidenceMarker band="high" />);
    expect(high).toBeEmptyDOMElement();

    render(
      <>
        {CONFIDENCE_BAND_VALUES.filter((b) => b !== "high").map((band) => (
          <ConfidenceMarker key={band} band={band} />
        ))}
      </>,
    );
    expect(screen.getByText("Độ tin cậy trung bình")).toBeInTheDocument();
    expect(screen.getByText("Độ tin cậy thấp")).toBeInTheDocument();
  });

  it("BR-020: the confidence marker says it is not a probability", () => {
    render(<ConfidenceMarker band="low" />);
    expect(screen.getByTitle(/không phải xác suất/i)).toBeInTheDocument();
  });

  it("BR-025: an overridden value is labelled Analyst, an AI value is labelled AI", () => {
    render(
      <>
        <ValueSourceBadge source="ai" />
        <ValueSourceBadge source="analyst" />
      </>,
    );
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Chuyên viên")).toBeInTheDocument();
  });
});
