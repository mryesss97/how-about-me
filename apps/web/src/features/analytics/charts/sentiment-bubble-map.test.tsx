import type { PhraseSentimentResponse } from "@how-about-me/contracts";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SentimentBubbleMap } from "./sentiment-bubble-map";
import { emptyTopicSentiment, topicSentimentFixture } from "./topic-sentiment-fixture.test-utils";

const getHref = (t: string, s: string | null) => `/mentions?topic=${t}${s ? `&sentiment=${s}` : ""}`;
const TICKET = "Ticket, 50.0% negative, 4 mentions";

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
    expect(screen.getByRole("button", { name: "Price, 75.0% positive, 4 mentions" })).toBeInTheDocument();
    const chip = screen.getByRole("radio", { name: /Negative \(3\)/ });
    expect(chip.querySelector("[data-icon=negative]")).not.toBeNull();
  });

  it("chips filter bubbles by dominant sentiment; neutral shows inline empty state", async () => {
    render(<SentimentBubbleMap data={topicSentimentFixture()} getHref={getHref} />);
    expect(screen.getByText("4 topics")).toBeInTheDocument();
    await click(screen.getByRole("radio", { name: /Positive \(1\)/ }));
    expect(screen.getAllByRole("button", { name: /mentions$/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Price, 75.0% positive, 4 mentions",
    ]);
    expect(screen.getByText("1 topic")).toBeInTheDocument();
    await click(screen.getByRole("radio", { name: /Neutral \(0\)/ }));
    expect(screen.getByText("No topics where neutral is dominant.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /All/ })).toBeInTheDocument();
  });

  it("keyboard: Enter selects (aria-pressed), panel shows breakdown, Escape deselects; FR-142 links", async () => {
    render(<SentimentBubbleMap data={topicSentimentFixture()} getHref={getHref} />);
    const bubble = screen.getByRole("button", { name: TICKET });
    bubble.focus();
    await click(bubble); // native <button>: Enter/Space dispatch click
    expect(bubble).toHaveAttribute("aria-pressed", "true");
    const panel = screen.getByRole("complementary");
    expect(within(panel).getAllByText("1 · 25.0%")).toHaveLength(2);
    expect(within(panel).getByText("2 · 50.0%")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Negative" })).toHaveAttribute(
      "href",
      "/mentions?topic=ticket&sentiment=negative",
    );
    expect(within(panel).getByRole("link", { name: "View all 4 mentions" })).toHaveAttribute(
      "href",
      "/mentions?topic=ticket",
    );
    await act(async () => fireEvent.keyDown(bubble, { key: "Escape" }));
    expect(bubble).toHaveAttribute("aria-pressed", "false");
    expect(within(panel).getByText(/Select a bubble/)).toBeInTheDocument();
  });

  it("FR-142: zero-count rows are not links; `other` drills", async () => {
    render(<SentimentBubbleMap data={topicSentimentFixture()} getHref={getHref} />);
    await click(screen.getByRole("button", { name: /^Venue/ }));
    const panel = screen.getByRole("complementary");
    expect(within(panel).queryByRole("link", { name: "Positive" })).toBeNull();
    await click(screen.getByRole("button", { name: /^Other/ }));
    expect(within(panel).getByRole("link", { name: "Negative" })).toHaveAttribute(
      "href",
      "/mentions?topic=other&sentiment=negative",
    );
  });

  it("NFR-032: Bubbles | Table toggle; table respects the chip and links the topic", async () => {
    render(<SentimentBubbleMap data={topicSentimentFixture()} getHref={getHref} />);
    await click(screen.getByRole("radio", { name: /Negative \(3\)/ }));
    await click(screen.getByRole("radio", { name: "Table" }));
    const rows = Array.from(screen.getByRole("grid").querySelectorAll("tr")).map((r) =>
      Array.from(r.querySelectorAll("th, td")).map((c) => (c.textContent ?? "").trim()),
    );
    expect(rows[0]).toEqual([
      "Topic",
      "Dominant sentiment",
      "Dominant share",
      "Positive",
      "Neutral",
      "Negative",
      "With sentiment",
    ]);
    expect(rows[1]).toEqual(["Ticket", "Negative", "50.0%", "1", "1", "2", "4"]);
    expect(rows).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Ticket" })).toHaveAttribute("href", "/mentions?topic=ticket");
  });

  it("NFR-031: data-motion follows prefers-reduced-motion", () => {
    mockReducedMotion(true);
    const { unmount } = render(<SentimentBubbleMap data={topicSentimentFixture()} />);
    expect(screen.getByRole("group", { name: "Sentiment map bubbles" })).toHaveAttribute("data-motion", "reduced");
    unmount();
    mockReducedMotion(false);
    render(<SentimentBubbleMap data={topicSentimentFixture()} />);
    expect(screen.getByRole("group", { name: "Sentiment map bubbles" })).toHaveAttribute("data-motion", "full");
  });

  it("BR-032: no sentiment → explicit empty state without chips or toggle; error shows retry", () => {
    const { unmount } = render(<SentimentBubbleMap data={emptyTopicSentiment()} />);
    expect(screen.getByText("No analysed mentions in this range")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();
    unmount();
    render(<SentimentBubbleMap error={{ message: "boom", requestId: "req-9" }} onRetry={() => {}} />);
    expect(screen.getByText(/req-9/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/ })).toBeInTheDocument();
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
      const group = screen.getByRole("radiogroup", { name: "Group bubbles by" });
      await click(within(group).getByRole("radio", { name: "Phrases" }));
      expect(onModeChange).toHaveBeenCalledWith("phrases");
      unmount();
      render(<SentimentBubbleMap data={topicSentimentFixture()} />);
      expect(screen.queryByRole("radiogroup", { name: "Group bubbles by" })).toBeNull();
    });

    it("phrase bubbles are named verbatim and drill to phrase=…; footer shows top N of total", async () => {
      render(
        <SentimentBubbleMap phraseData={phraseData()} mode="phrases" onModeChange={() => {}} getHref={phraseHref} />,
      );
      const bubble = screen.getByRole("button", { name: "giá vé, 75.0% negative, 4 mentions" });
      expect(screen.getByText("Top 2 of 40 phrases")).toBeInTheDocument();
      expect(screen.getByText("Key phrases in analysed mentions")).toBeInTheDocument();
      await click(bubble);
      const panel = screen.getByRole("complementary");
      expect(within(panel).getByRole("link", { name: "Negative" })).toHaveAttribute(
        "href",
        `/mentions?phrase=${encodeURIComponent("giá vé")}&sentiment=negative`,
      );
      await click(screen.getByRole("radio", { name: "Table" }));
      const head = screen.getByRole("grid").querySelector("tr")?.querySelector("th")?.textContent;
      expect(head).toBe("Phrase");
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
      expect(screen.getByText("No phrases yet — re-analyse to extract phrases")).toBeInTheDocument();
      expect(screen.getByText(/have no phrases until they are re-analysed/)).toBeInTheDocument();
      r1.unmount();
      const r2 = render(<SentimentBubbleMap mode="phrases" phraseData={phraseData({ totalPhrases: 0, rows: [] })} />);
      expect(screen.getByText("No phrase reaches 2 mentions")).toBeInTheDocument();
      r2.unmount();
      render(
        <SentimentBubbleMap
          mode="phrases"
          phraseData={phraseData({ sentimentAnalyzed: 0, phraseAnalyzed: 0, totalPhrases: 0, rows: [] })}
        />,
      );
      expect(screen.getByText("No analysed mentions in this range")).toBeInTheDocument();
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
      await click(screen.getByRole("radio", { name: "Topics" }));
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
      await click(screen.getByRole("radio", { name: "Topics" }));
      expect(onModeChange).toHaveBeenCalledWith("topics");
    });
  });
});
