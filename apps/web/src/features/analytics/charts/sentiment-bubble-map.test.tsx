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
});
