import { render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { meFixture, P1, projectFixture, Providers } from "@/features/auth/test-utils";
import { overviewFixture } from "./landing-fixture.test-utils";
import { LandingView } from "./landing-view";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
let reduced = false;
vi.mock("@/hooks/use-prefers-reduced-motion", () => ({ usePrefersReducedMotion: () => reduced }));
vi.mock("@/hooks/use-breakpoint", () => ({ useBreakpoint: () => true }));

const LANDING = {
  range: { from: "2026-09-14T12:00:00+07:00", to: "2026-10-14T12:00:00+07:00", timezone: "Asia/Ho_Chi_Minh" },
  sentimentAnalyzed: 100,
  rows: [
    { term: "giá vé", positive: 62, neutral: 38, negative: 0, total: 100, dominant: "positive", dominantShare: 0.62 },
    { term: "dịch vụ", positive: 1, neutral: 0, negative: 3, total: 4, dominant: "negative", dominantShare: 0.75 },
  ],
};

type Mode = { role?: "admin" | "viewer"; landing?: unknown; overview?: unknown | "pending" | "error" };
function setup({ role = "viewer", landing = LANDING, overview = overviewFixture() }: Mode = {}) {
  apiFetch.mockImplementation((path: string) => {
    if (path === "/me") return Promise.resolve(meFixture([projectFixture(P1, role)]));
    if (path.endsWith("/landing-terms"))
      return landing === "error" ? Promise.reject(new Error("x")) : Promise.resolve(landing);
    if (path.endsWith("/overview")) {
      if (overview === "pending") return new Promise(() => {});
      if (overview === "error") return Promise.reject(new Error("x"));
      return Promise.resolve(overview);
    }
    return Promise.reject(new Error(`unexpected ${path}`));
  });
  return render(<LandingView />, { wrapper: Providers });
}

// jsdom has no layout: give the canvas a size; hero/stats rects stay 0 (unmeasured → no exclusion).
const sizes = { clientWidth: 1366, clientHeight: 768 };
const orig: Record<string, PropertyDescriptor | undefined> = {};
beforeAll(() => {
  for (const [k, v] of Object.entries(sizes)) {
    orig[k] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, k);
    Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
  }
});
afterAll(() => {
  for (const [k, d] of Object.entries(orig)) if (d) Object.defineProperty(HTMLElement.prototype, k, d);
});
beforeEach(() => {
  apiFetch.mockReset();
  reduced = false;
});

// #262 — landing page (FR-149, BR-042, BR-017)
describe("LandingView", () => {
  it("FR-149: one balloon per term with full accessible name; balloons are not links or buttons", async () => {
    setup();
    const balloons = await screen.findAllByRole("img", { name: /mentions?$/ });
    expect(balloons).toHaveLength(2);
    expect(screen.getByRole("img", { name: "giá vé · 62.0% positive · 100 mentions" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.queryByRole("button", { name: /giá vé/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /giá vé/ })).not.toBeInTheDocument();
  });

  it("stats use the landing range with compare and never show safety (BR-017)", async () => {
    setup();
    expect(await screen.findByText("1,284")).toBeInTheDocument();
    expect(screen.getByLabelText("+12.0%")).toHaveTextContent("↑ 12.0%");
    expect(screen.getByText("62.0%")).toBeInTheDocument();
    expect(screen.queryByText(/safety/i)).not.toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(`/projects/${P1}/analytics/overview`, {
      params: { compare: "true", from: LANDING.range.from, timezone: LANDING.range.timezone, to: LANDING.range.to },
    });
  });

  it("Explore links to /overview", async () => {
    setup();
    expect(await screen.findByRole("link", { name: "Explore dashboard" })).toHaveAttribute("href", "/overview");
  });

  it("stats loading → skeleton", async () => {
    setup({ overview: "pending" });
    await screen.findAllByRole("img", { name: /mentions?$/ });
    expect(screen.getAllByTestId("landing-stat-skeleton")).toHaveLength(4);
  });

  it("stats error → hidden, Explore still shown", async () => {
    setup({ overview: "error" });
    await screen.findAllByRole("img", { name: /mentions?$/ });
    await waitFor(() => expect(screen.queryAllByTestId("landing-stat-skeleton")).toHaveLength(0));
    expect(screen.queryByText("Mentions")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore dashboard" })).toBeInTheDocument();
  });

  it("landing-terms error → no balloons; stats fall back to a 30-day range", async () => {
    setup({ landing: "error" });
    expect(await screen.findByText("1,284")).toBeInTheDocument();
    expect(screen.queryAllByRole("img", { name: /mentions?$/ })).toHaveLength(0);
  });

  it("empty terms: admin gets a Settings link", async () => {
    setup({ role: "admin", landing: { ...LANDING, rows: [] } });
    expect(await screen.findByRole("link", { name: "Add landing phrases in Settings" })).toHaveAttribute(
      "href",
      "/settings/project",
    );
  });

  it("empty terms: viewer gets a neutral line only", async () => {
    setup({ role: "viewer", landing: { ...LANDING, rows: [] } });
    expect(await screen.findByText("No landing phrases configured yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Settings/ })).not.toBeInTheDocument();
  });

  it("NFR-031: reduced motion → data-motion=reduced", async () => {
    reduced = true;
    setup();
    await screen.findAllByRole("img", { name: /mentions?$/ });
    expect(screen.getByRole("group", { name: /landing terms/ })).toHaveAttribute("data-motion", "reduced");
  });

  it("#267: two-line headline, no stacked logo in the hero, horizontal logo in the top bar", async () => {
    setup();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("See how Threadsfeels about you.");
    const logos = screen.getAllByRole("img", { name: "How About Me" });
    expect(logos).toHaveLength(1);
    expect(logos[0]).toHaveAttribute("src", "/brand/logo-horizontal-primary.svg");
    expect(screen.getByTestId("landing-top-bar")).toContainElement(logos[0] ?? null);
  });

  it("#267, FR-149: orb face shows term + share without the sentiment word; aria-label stays complete", async () => {
    setup();
    const orb = await screen.findByRole("img", { name: "giá vé · 62.0% positive · 100 mentions" });
    const face = Array.from(orb.querySelectorAll("span"))
      .filter((el) => !el.className.includes("opacity-0") && !el.closest(".opacity-0"))
      .map((el) => el.textContent)
      .join(" ");
    expect(face).toContain("62%");
    expect(face).not.toMatch(/positive|negative/);
  });

  it("#267: empty state shows 5 ghost circles and the pill", async () => {
    setup({ role: "viewer", landing: { ...LANDING, rows: [] } });
    expect(await screen.findByText("No landing phrases configured yet.")).toBeInTheDocument();
    expect(screen.getAllByTestId("landing-ghost")).toHaveLength(5);
  });

  it("#267: stats show the legend caption and uppercase-by-CSS labels", async () => {
    setup();
    expect(await screen.findByText("1,284")).toBeInTheDocument();
    expect(screen.getByText(/Orb size = mentions/)).toBeInTheDocument();
    expect(screen.getByText("Updated")).toHaveClass("uppercase");
  });

  it("#267: Live eyebrow only after a sync", async () => {
    setup({ overview: overviewFixture({ lastSyncAt: null }) });
    expect(await screen.findByText("Not synced")).toBeInTheDocument();
    expect(screen.queryByText(/^Live/)).not.toBeInTheDocument();
  });
});
