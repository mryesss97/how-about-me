import { render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { meFixture, P1, projectFixture, Providers } from "@/features/auth/test-utils";
import { defaultFilters } from "@/lib/filters";
import { DEFAULT_TZ } from "@/lib/filters/parsers";
import { termDetailCopy as copy } from "./copy";
import { TermDetailView, termSplit } from "./term-detail-view";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
// Charts are lazy (next/dynamic); the hero is what this page adds.
vi.mock("./charts", () => {
  const Stub = () => null;
  return {
    MentionsOverTimeChart: Stub,
    SentimentDistributionChart: Stub,
    SentimentOverTimeChart: Stub,
    TopTopicsChart: Stub,
  };
});
vi.mock("./filter-bar", () => ({ FilterBar: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const Wrapper = ({ children }: { children: ReactNode }) => (
  <Providers>
    <NuqsTestingAdapter searchParams="?preset=30d">{children}</NuqsTestingAdapter>
  </Providers>
);

const sentiment = (pos: number, neu: number, neg: number) => {
  const total = pos + neu + neg;
  return {
    denominator: total,
    distribution: [
      { label: "positive", count: pos, share: total ? pos / total : null },
      { label: "neutral", count: neu, share: total ? neu / total : null },
      { label: "negative", count: neg, share: total ? neg / total : null },
    ],
  };
};

function setup(data = sentiment(7, 30, 45)) {
  apiFetch.mockImplementation((path: string = "") => {
    if (path === "/me") return Promise.resolve(meFixture([projectFixture(P1, "viewer")]));
    if (path.endsWith("/analytics/sentiment")) return Promise.resolve(data);
    return new Promise(() => {});
  });
  return render(<TermDetailView term="giá vé" />, { wrapper: Wrapper });
}

beforeEach(() => {
  apiFetch.mockReset();
});

// #276 phrase detail (BR-042, #273, BR-017)
describe("termSplit", () => {
  it("dominant with the board tie order and tones; total = sentiment denominator (= the landing board)", () => {
    expect(termSplit(sentiment(7, 30, 45) as never)).toMatchObject({
      total: 82,
      dominant: "negative",
      tone: "negative-mixed",
    });
    expect(termSplit(sentiment(0, 0, 94) as never)).toMatchObject({
      dominant: "negative",
      share: 1,
      tone: "negative-solid",
    });
    expect(termSplit(sentiment(5, 5, 5) as never).dominant).toBe("negative");
    expect(termSplit(sentiment(1, 8, 1) as never).tone).toBe("neutral");
    expect(termSplit(sentiment(0, 0, 0) as never).tone).toBe("blank");
  });
});

describe("termDetailCopy.period (#332)", () => {
  it("presets as words, custom as dd/MM–dd/MM", () => {
    expect(copy.period({ ...defaultFilters(DEFAULT_TZ), preset: "30d" })).toBe("30 NGÀY QUA");
    const custom = {
      ...defaultFilters(DEFAULT_TZ),
      preset: "custom" as const,
      from: new Date("2026-09-30T17:00:00.000Z"),
      to: new Date("2026-10-07T17:00:00.000Z"),
    };
    expect(copy.period(custom)).toBe("01/10–07/10");
  });
});

describe("TermDetailView", () => {
  it("hero: quoted phrase, dominant share + count, split with words, links back and to Bài nhắc", async () => {
    setup();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent('"giá vé"');
    expect(await screen.findByText(/54,9% Tiêu cực · 82 lượt nhắc có cảm xúc · 30 NGÀY QUA/)).toBeInTheDocument();
    expect(screen.getByText("Tích cực")).toBeInTheDocument();
    // #331 / FR-142: the link pins the page range (30 days) as custom and keeps the term.
    const all = new URL(
      screen.getByRole("link", { name: /Xem tất cả trong Bài nhắc/ }).getAttribute("href") ?? "",
      "http://x",
    );
    expect(all.pathname).toBe("/mentions");
    expect(all.searchParams.get("preset")).toBe("custom");
    expect(all.searchParams.get("term")).toBe("giá vé");
    const days =
      (Date.parse(all.searchParams.get("to") ?? "") - Date.parse(all.searchParams.get("from") ?? "")) / 864e5;
    expect(Math.round(days)).toBe(30);
    expect(screen.getByRole("link", { name: /Về bức tường cụm từ/ })).toHaveAttribute("href", "/");
  });

  it("every analytics request carries the term (BR-042, #273), without compare", async () => {
    setup();
    await screen.findByText(/82 lượt nhắc/);
    const calls = apiFetch.mock.calls.filter(([p]) => String(p).includes("/analytics/"));
    expect(calls.length).toBeGreaterThan(0);
    for (const [, opts] of calls) {
      expect((opts as { params: Record<string, string> }).params.term).toBe("giá vé");
      expect((opts as { params: Record<string, string> }).params.compare).toBeUndefined();
    }
  });

  it("0 mentions → empty line instead of a split", async () => {
    setup(sentiment(0, 0, 0));
    expect(await screen.findByText(/Chưa ai nhắc tới cụm từ này/)).toBeInTheDocument();
  });
});
