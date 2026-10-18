import { render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { meFixture, P1, projectFixture, Providers } from "@/features/auth/test-utils";
import { defaultFilters } from "@/lib/filters";
import { DEFAULT_TZ } from "@/lib/filters/parsers";
import { termDetailCopy as copy } from "./copy";
import { heroParams, TermDetailView, termSplit } from "./term-detail-view";

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
vi.mock("./filter-bar", () => ({ FilterBar: () => <div data-testid="filter-bar" /> }));
const mentionsProps = vi.fn();
const renderList = (p: unknown) => {
  mentionsProps(p);
  return <div data-testid="term-mentions" />;
};
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

let search = "?preset=30d";
const Wrapper = ({ children }: { children: ReactNode }) => (
  <Providers>
    <NuqsTestingAdapter searchParams={search}>{children}</NuqsTestingAdapter>
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

type Data = ReturnType<typeof sentiment>;
const isPrev = (p: Record<string, string>) => Date.parse(p.to) < Date.now() - 864e5;

function setup(data: Data = sentiment(7, 30, 45), opts: { previous?: Data; filtered?: Data; landing?: string[] } = {}) {
  apiFetch.mockImplementation((path: string = "", o?: { params: Record<string, string> }) => {
    if (path === "/me") return Promise.resolve(meFixture([projectFixture(P1, "viewer")]));
    if (path.endsWith("/analytics/sentiment")) {
      const p = o?.params ?? {};
      if (isPrev(p)) return Promise.resolve(opts.previous ?? sentiment(0, 0, 0));
      if (p.sentiment && opts.filtered) return Promise.resolve(opts.filtered);
      return Promise.resolve(data);
    }
    if (path.endsWith("/analytics/landing-terms") && opts.landing) {
      const rows = opts.landing.map((term) => ({
        term,
        positive: 1,
        neutral: 0,
        negative: 0,
        total: 1,
        dominant: "positive",
        dominantShare: 1,
      }));
      return Promise.resolve({
        range: { from: o?.params.from, to: o?.params.to, timezone: DEFAULT_TZ },
        sentimentAnalyzed: 1,
        rows,
      });
    }
    return new Promise(() => {});
  });
  return render(<TermDetailView term="giá vé" renderList={renderList} />, { wrapper: Wrapper });
}

beforeEach(() => {
  apiFetch.mockReset();
  mentionsProps.mockReset();
  search = "?preset=30d";
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

describe("heroParams (#333 entry-1, BR-042, BR-016)", () => {
  it("keeps range/tz/relevance/term only", () => {
    const live = {
      analysisStatus: "done",
      compare: "true",
      from: "a",
      intent: "complaint",
      language: "vi",
      phrase: "x",
      queryIds: "q",
      relevance: "relevant",
      safety: "safe",
      sentiment: "negative",
      timezone: "Asia/Ho_Chi_Minh",
      to: "b",
      topic: "price",
    };
    expect(heroParams(live, "giá vé")).toEqual({
      from: "a",
      relevance: "relevant",
      term: "giá vé",
      timezone: "Asia/Ho_Chi_Minh",
      to: "b",
    });
  });
});

describe("TermDetailView", () => {
  it("hero: quoted phrase, dominant share + count in bài nhắc, back to Trang chủ, no BR code (#333)", async () => {
    setup();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent('"giá vé"');
    expect(await screen.findByText(/54,9% Tiêu cực · 82 bài nhắc · 30 NGÀY QUA/)).toBeInTheDocument();
    expect(screen.queryByText(/lượt nhắc/)).not.toBeInTheDocument();
    expect(screen.queryByText(/BR-042/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Trang chủ/ })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: /Bài nhắc$/ })).not.toBeInTheDocument();
  });

  it("split figures link to the list tab with the anchor; name carries the word (BR-017)", async () => {
    setup();
    const link = await screen.findByRole("link", { name: "Tiêu cực 54,9% (45 bài nhắc)" });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("list=negative");
    expect(href.endsWith("#bai-nhac")).toBe(true);
  });

  it("order: hero → mentions (with hero counts) → filter bar (#333 entry-3)", async () => {
    const { container } = setup();
    await screen.findByText(/82 bài nhắc/);
    const mentions = screen.getByTestId("term-mentions");
    const bar = screen.getByTestId("filter-bar");
    expect(container.querySelector(".term-hero")?.compareDocumentPosition(mentions)).toBe(4);
    expect(mentions.compareDocumentPosition(bar)).toBe(4);
    expect(mentionsProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ counts: { positive: 7, neutral: 30, negative: 45 }, total: 82 }),
    );
  });

  it("sentiment filter does not change the hero; a note names the filter (#333 entry-1)", async () => {
    search = "?preset=30d&sentiment=negative";
    setup(sentiment(7, 30, 45), { filtered: sentiment(0, 0, 45) });
    expect(await screen.findByText(/54,9% Tiêu cực · 82 bài nhắc/)).toBeInTheDocument();
    expect(screen.getByText(/đang lọc: Cảm xúc: Tiêu cực/)).toBeInTheDocument();
    const heroCalls = apiFetch.mock.calls.filter(
      ([p, o]) =>
        String(p).endsWith("/analytics/sentiment") && !(o as { params: Record<string, string> }).params.sentiment,
    );
    expect(heroCalls.length).toBeGreaterThan(0);
  });

  it("change vs previous period: up + negative share (#333 entry-5)", async () => {
    setup(sentiment(15, 15, 8), { previous: sentiment(20, 7, 4) });
    expect(await screen.findByText(/22,6% so với kỳ trước · kỳ trước: 31/)).toBeInTheDocument();
    expect(screen.getByText("Tiêu cực: 21,1% (kỳ trước 12,9%)")).toBeInTheDocument();
  });

  it("previous period 0 → Mới, no negative comparison", async () => {
    setup(sentiment(1, 1, 1), { previous: sentiment(0, 0, 0) });
    expect(await screen.findByText("Mới trong kỳ này")).toBeInTheDocument();
    expect(screen.queryByText(/kỳ trước \d/)).not.toBeInTheDocument();
  });

  it("every analytics request carries the term (BR-042, #273), without compare", async () => {
    setup();
    await screen.findByText(/82 bài nhắc/);
    const calls = apiFetch.mock.calls.filter(([p]) => String(p).includes("/analytics/sentiment"));
    expect(calls.length).toBeGreaterThan(0);
    for (const [, opts] of calls) {
      expect((opts as { params: Record<string, string> }).params.term).toBe("giá vé");
      expect((opts as { params: Record<string, string> }).params.compare).toBeUndefined();
    }
  });

  it("Cụm từ khác: other configured terms with the range; nothing for unconfigured (#333 entry-9)", async () => {
    setup(sentiment(1, 1, 1), { landing: ["lightstick", "giá vé", "concert"] });
    const nav = await screen.findByRole("navigation", { name: "Cụm từ khác:" });
    const links = [...nav.querySelectorAll("a")];
    expect(links.map((a) => a.textContent)).toEqual(["lightstick", "concert"]);
    expect(links[0]?.getAttribute("href")).toBe("/terms/lightstick?preset=30d");
  });

  it("unconfigured term → no Cụm từ khác", async () => {
    setup(sentiment(1, 1, 1), { landing: ["lightstick"] });
    await screen.findByText(/3 bài nhắc/);
    expect(screen.queryByRole("navigation", { name: "Cụm từ khác:" })).not.toBeInTheDocument();
  });

  it("0 posts, 30 days → one empty state: no list/charts, only Về trang chủ (#333 entry-10)", async () => {
    setup(sentiment(0, 0, 0));
    expect(await screen.findByText(/Chưa ai nhắc tới cụm từ này/)).toBeInTheDocument();
    expect(screen.queryByTestId("term-mentions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("filter-bar")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về trang chủ" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "Mở rộng ra 30 ngày" })).not.toBeInTheDocument();
  });

  it("0 posts, 7 days → Mở rộng ra 30 ngày", async () => {
    search = "?preset=7d";
    setup(sentiment(0, 0, 0));
    expect(await screen.findByRole("button", { name: "Mở rộng ra 30 ngày" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Về trang chủ" })).not.toBeInTheDocument();
  });

  it("0 posts with an enum filter → full layout", async () => {
    search = "?preset=30d&sentiment=negative";
    setup(sentiment(0, 0, 0));
    expect(await screen.findByText(/Chưa ai nhắc tới cụm từ này/)).toBeInTheDocument();
    expect(screen.getByTestId("term-mentions")).toBeInTheDocument();
  });
});
