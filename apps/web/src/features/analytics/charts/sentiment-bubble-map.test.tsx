import type { PhraseSentimentResponse, TopicSentimentResponse } from "@how-about-me/contracts";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BubbleLabel } from "@/features/shared/bubbles/bubble-3d";
import { type BubbleDatum, toTopicBubbles } from "./bubble-layout";
import { SentimentBubbleMap } from "./sentiment-bubble-map";
import { emptyTopicSentiment, topicSentimentFixture } from "./topic-sentiment-fixture.test-utils";

const getHref = (t: string, s: string | null) => `/mentions?topic=${t}${s ? `&sentiment=${s}` : ""}`;
const TICKET = "Vé, 50,0% tiêu cực, 4 lượt nhắc";

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

async function click(el: HTMLElement) {
  await act(async () => fireEvent.click(el));
}

afterEach(() => vi.unstubAllGlobals());

/** #222 — FR-144, FR-142, NFR-030..032, BR-017, BR-032; TC-DASH-028. */
describe("SentimentBubbleMap (#222)", () => {
  it("NFR-030: each bubble is a named button; chips carry text and icon", () => {
    render(<SentimentBubbleMap data={topicSentimentFixture()} getHref={getHref} />);
    expect(screen.getByRole("button", { name: TICKET })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Giá, 75,0% tích cực, 4 lượt nhắc" })).toBeInTheDocument();
    const chip = screen.getByRole("radio", { name: /Tiêu cực \(3\)/ });
    expect(chip.querySelector("[data-icon=negative]")).not.toBeNull();
  });

  it("chips filter bubbles by dominant sentiment; neutral shows inline empty state", async () => {
    render(<SentimentBubbleMap data={topicSentimentFixture()} getHref={getHref} />);
    expect(screen.getByText("4 chủ đề")).toBeInTheDocument();
    await click(screen.getByRole("radio", { name: /Tích cực \(1\)/ }));
    expect(screen.getAllByRole("button", { name: /lượt nhắc$/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Giá, 75,0% tích cực, 4 lượt nhắc",
    ]);
    expect(screen.getByText("1 chủ đề")).toBeInTheDocument();
    await click(screen.getByRole("radio", { name: /Trung tính \(0\)/ }));
    expect(screen.getByText("Không có chủ đề nào mà cảm xúc trung tính chiếm ưu thế.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Tất cả/ })).toBeInTheDocument();
  });

  it("keyboard: Enter selects (aria-pressed), panel shows breakdown, Escape deselects; FR-142 links", async () => {
    render(<SentimentBubbleMap data={topicSentimentFixture()} getHref={getHref} />);
    const bubble = screen.getByRole("button", { name: TICKET });
    bubble.focus();
    await click(bubble); // native <button>: Enter/Space dispatch click
    expect(bubble).toHaveAttribute("aria-pressed", "true");
    const panel = screen.getByRole("complementary");
    expect(within(panel).getAllByText("1 · 25,0%")).toHaveLength(2);
    expect(within(panel).getByText("2 · 50,0%")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Tiêu cực" })).toHaveAttribute(
      "href",
      "/mentions?topic=ticket&sentiment=negative",
    );
    expect(within(panel).getByRole("link", { name: "Xem tất cả 4 lượt nhắc" })).toHaveAttribute(
      "href",
      "/mentions?topic=ticket",
    );
    await act(async () => fireEvent.keyDown(bubble, { key: "Escape" }));
    expect(bubble).toHaveAttribute("aria-pressed", "false");
    expect(within(panel).getByText(/Chọn một bong bóng/)).toBeInTheDocument();
  });

  it("FR-142: zero-count rows are not links; `other` drills", async () => {
    render(<SentimentBubbleMap data={topicSentimentFixture()} getHref={getHref} />);
    await click(screen.getByRole("button", { name: /^Địa điểm/ }));
    const panel = screen.getByRole("complementary");
    expect(within(panel).queryByRole("link", { name: "Tích cực" })).toBeNull();
    await click(screen.getByRole("button", { name: /^Khác/ }));
    expect(within(panel).getByRole("link", { name: "Tiêu cực" })).toHaveAttribute(
      "href",
      "/mentions?topic=other&sentiment=negative",
    );
  });

  it("#336 / NFR-032 / FR-144: Topics 'Bảng' shows coloured count · share cells, respects the chip, links each cell", async () => {
    render(<SentimentBubbleMap data={topicSentimentFixture()} getHref={getHref} />);
    await click(screen.getByRole("radio", { name: /Tiêu cực \(3\)/ }));
    await click(screen.getByRole("button", { name: "Bảng" }));
    expect(screen.getByRole("button", { name: "Bảng" })).toHaveAttribute("aria-pressed", "true");
    const table = screen.getByRole("table", { name: "Bản đồ cảm xúc (bảng)" });
    const headers = within(table)
      .getAllByRole("rowheader")
      .map((h) => h.firstChild?.textContent);
    // Chip "Tiêu cực" keeps only negative-dominant topics (price is positive-dominant).
    expect(headers).toEqual(["Vé", "Địa điểm", "Khác"]);
    // BR-017: count is always printed; FR-142: non-zero cells drill topic & sentiment.
    expect(within(table).getByRole("link", { name: /^Vé · Tiêu cực: 2 lượt nhắc, 50,0%/ })).toHaveAttribute(
      "href",
      "/mentions?topic=ticket&sentiment=negative",
    );
    expect(within(table).queryByRole("link", { name: /^Địa điểm · Tích cực/ })).toBeNull();
    expect(screen.queryByText("Chủ đề × cảm xúc")).toBeNull();
  });

  it("NFR-031: data-motion follows prefers-reduced-motion", () => {
    mockReducedMotion(true);
    const { unmount } = render(<SentimentBubbleMap data={topicSentimentFixture()} />);
    expect(screen.getByRole("group", { name: "Bong bóng bản đồ cảm xúc" })).toHaveAttribute("data-motion", "reduced");
    unmount();
    mockReducedMotion(false);
    render(<SentimentBubbleMap data={topicSentimentFixture()} />);
    expect(screen.getByRole("group", { name: "Bong bóng bản đồ cảm xúc" })).toHaveAttribute("data-motion", "full");
  });

  it("BR-032: no sentiment → explicit empty state without chips or toggle; error shows retry", () => {
    const { unmount } = render(<SentimentBubbleMap data={emptyTopicSentiment()} />);
    expect(screen.getByText("Chưa có lượt nhắc đã phân tích trong khoảng này")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();
    unmount();
    render(<SentimentBubbleMap error={{ message: "boom", requestId: "req-9" }} onRetry={() => {}} />);
    expect(screen.getByText(/req-9/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thử lại/ })).toBeInTheDocument();
  });

  it("BR-017: bubbles use sentiment hues only, never safety colours", () => {
    const { container } = render(<SentimentBubbleMap data={topicSentimentFixture()} />);
    expect(container.innerHTML).not.toMatch(/yellow/);
  });

  describe("Topics | Phrases toggle (#243, FR-148, BR-041)", () => {
    const phraseHref = (p: string, s: string | null) =>
      `/mentions?phrase=${encodeURIComponent(p)}${s ? `&sentiment=${s}` : ""}`;
    const phraseData = (patch: Partial<PhraseSentimentResponse> = {}): PhraseSentimentResponse => ({
      sentimentAnalyzed: 10,
      phraseAnalyzed: 8,
      totalPhrases: 40,
      minMentions: 2,
      limit: 30,
      rows: [
        { phrase: "giá vé", positive: 1, neutral: 0, negative: 3, total: 4, negativeShare: 0.75 },
        { phrase: "xếp hàng", positive: 2, neutral: 0, negative: 0, total: 2, negativeShare: 0 },
      ],
      ...patch,
    });

    it("toggle calls onModeChange; no toggle without the callback", async () => {
      const onModeChange = vi.fn();
      const { unmount } = render(
        <SentimentBubbleMap data={topicSentimentFixture()} mode="topics" onModeChange={onModeChange} />,
      );
      const group = screen.getByRole("radiogroup", { name: "Nhóm bong bóng theo" });
      await click(within(group).getByRole("radio", { name: "Cụm từ" }));
      expect(onModeChange).toHaveBeenCalledWith("phrases");
      unmount();
      render(<SentimentBubbleMap data={topicSentimentFixture()} />);
      expect(screen.queryByRole("radiogroup", { name: "Nhóm bong bóng theo" })).toBeNull();
    });

    it("phrase bubbles are named verbatim and drill to phrase=…; footer shows top N of total", async () => {
      render(
        <SentimentBubbleMap phraseData={phraseData()} mode="phrases" onModeChange={() => {}} getHref={phraseHref} />,
      );
      const bubble = screen.getByRole("button", { name: "giá vé, 75,0% tiêu cực, 4 lượt nhắc" });
      expect(screen.getByText("Top 2 trên 40 cụm từ")).toBeInTheDocument();
      expect(screen.getByText("Cụm từ chính trong các lượt nhắc đã phân tích")).toBeInTheDocument();
      await click(bubble);
      const panel = screen.getByRole("complementary");
      expect(within(panel).getByRole("link", { name: "Tiêu cực" })).toHaveAttribute(
        "href",
        `/mentions?phrase=${encodeURIComponent("giá vé")}&sentiment=negative`,
      );
      await click(screen.getByRole("button", { name: "Bảng" }));
      const head = screen.getByRole("grid").querySelector("tr")?.querySelector("th")?.textContent;
      expect(head).toBe("Cụm từ");
      expect(screen.getByRole("link", { name: "giá vé" })).toHaveAttribute(
        "href",
        `/mentions?phrase=${encodeURIComponent("giá vé")}`,
      );
    });

    it("BR-017: phrase bubbles use sentiment hues only", () => {
      const { container } = render(<SentimentBubbleMap phraseData={phraseData()} mode="phrases" />);
      expect(container.innerHTML).not.toMatch(/yellow/);
    });

    it("empty states: no phrases yet / none reaching minMentions / 0 mentions (BR-032)", () => {
      const r1 = render(<SentimentBubbleMap mode="phrases" phraseData={phraseData({ phraseAnalyzed: 0, rows: [] })} />);
      expect(screen.getByText("Chưa có cụm từ — hãy phân tích lại để trích xuất cụm từ")).toBeInTheDocument();
      expect(screen.getByText(/chưa có cụm từ cho tới khi được phân tích lại/)).toBeInTheDocument();
      r1.unmount();
      const r2 = render(<SentimentBubbleMap mode="phrases" phraseData={phraseData({ totalPhrases: 0, rows: [] })} />);
      expect(screen.getByText("Không có cụm từ nào đạt 2 lượt nhắc")).toBeInTheDocument();
      r2.unmount();
      render(
        <SentimentBubbleMap
          mode="phrases"
          phraseData={phraseData({ sentimentAnalyzed: 0, phraseAnalyzed: 0, totalPhrases: 0, rows: [] })}
        />,
      );
      expect(screen.getByText("Chưa có lượt nhắc đã phân tích trong khoảng này")).toBeInTheDocument();
    });

    it("QA #243: toggle stays reachable in phrase empty and error states", async () => {
      const onModeChange = vi.fn();
      const r1 = render(
        <SentimentBubbleMap
          mode="phrases"
          onModeChange={onModeChange}
          phraseData={phraseData({ phraseAnalyzed: 0, rows: [] })}
        />,
      );
      await click(screen.getByRole("radio", { name: "Chủ đề" }));
      expect(onModeChange).toHaveBeenCalledWith("topics");
      r1.unmount();
      onModeChange.mockClear();
      render(
        <SentimentBubbleMap
          mode="phrases"
          onModeChange={onModeChange}
          error={{ message: "boom", requestId: "req-1" }}
          onRetry={() => {}}
        />,
      );
      await click(screen.getByRole("radio", { name: "Chủ đề" }));
      expect(onModeChange).toHaveBeenCalledWith("topics");
    });
  });
});

describe("#389 sentiment always has a word or icon (BR-017)", () => {
  const [datum] = toTopicBubbles([
    { topic: "ticket", positive: 3, neutral: 0, negative: 1, total: 4, negativeShare: 0.25 },
  ]);
  const rows = (): TopicSentimentResponse => ({
    rows: [
      { topic: "ticket", positive: 300, neutral: 50, negative: 50, total: 400, negativeShare: 0.125 },
      { topic: "price", positive: 1, neutral: 1, negative: 1, total: 3, negativeShare: 1 / 3 },
    ],
  });
  afterEach(() => vi.restoreAllMocks());
  // Small canvas so the minimum radius (25 % of the largest) falls below LABEL_COMPACT_R.
  function smallCanvas() {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(150);
  }

  it("BR-017 #389: compact label (r ≥ 44) carries the sentiment word", () => {
    const { container } = render(<BubbleLabel d={datum as BubbleDatum} r={50} tipBelow={false} />);
    expect(container.querySelector("span[aria-hidden].flex")?.textContent).toContain("75,0% tích cực");
  });

  it("BR-017 #389: narrow compact label (36–44) carries the sentiment icon + %", () => {
    const { container } = render(<BubbleLabel d={datum as BubbleDatum} r={40} tipBelow={false} />);
    const label = container.querySelector("span[aria-hidden].flex");
    expect(label?.querySelector('[data-icon="positive"]')).not.toBeNull();
    expect(label?.textContent).toContain("75,0%");
  });

  it("BR-017 #389: full label keeps the share line and mentions", () => {
    const { container } = render(<BubbleLabel d={datum as BubbleDatum} r={60} tipBelow={false} />);
    expect(container.textContent).toContain("75,0% tích cực");
    expect(container.textContent).toContain("4 lượt nhắc");
  });

  it("#389: tiny bubbles are listed in the 'Chủ đề nhỏ:' row; clicking selects the bubble", async () => {
    smallCanvas();
    render(<SentimentBubbleMap data={rows()} getHref={getHref} />);
    await act(async () => {});
    expect(screen.getByText("Chủ đề nhỏ:")).toBeInTheDocument();
    const plate = screen.getByRole("button", { name: "Giá · 33,3% tiêu cực (3)" });
    await click(plate);
    expect(plate).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Giá, 33,3% tiêu cực, 3 lượt nhắc" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("complementary")).toHaveTextContent("Giá");
  });

  it("#389: no tiny bubbles → no row", () => {
    render(<SentimentBubbleMap data={rows()} />);
    expect(screen.queryByText("Chủ đề nhỏ:")).toBeNull();
  });

  it("#389: a chip that hides the tiny topic removes it from the row", async () => {
    smallCanvas();
    render(<SentimentBubbleMap data={rows()} />);
    await act(async () => {});
    expect(screen.getByText("Chủ đề nhỏ:")).toBeInTheDocument();
    await click(screen.getByRole("radio", { name: /Tích cực/ }));
    expect(screen.queryByText("Chủ đề nhỏ:")).toBeNull();
  });

  it("#389 phrases: row heading is 'Cụm từ nhỏ:'", async () => {
    smallCanvas();
    const data: PhraseSentimentResponse = {
      sentimentAnalyzed: 10,
      phraseAnalyzed: 8,
      totalPhrases: 2,
      minMentions: 2,
      limit: 30,
      rows: [
        { phrase: "giá vé", positive: 1, neutral: 0, negative: 300, total: 301, negativeShare: 300 / 301 },
        { phrase: "xếp hàng", positive: 2, neutral: 0, negative: 0, total: 2, negativeShare: 0 },
      ],
    };
    render(<SentimentBubbleMap phraseData={data} mode="phrases" />);
    await act(async () => {});
    expect(screen.getByText("Cụm từ nhỏ:")).toBeInTheDocument();
  });
});
