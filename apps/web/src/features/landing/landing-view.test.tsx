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
// next/font is a build-time loader; give the test the shape it returns.
vi.mock("./landing-fonts", () => ({ signFont: { variable: "font-sign" }, figureFont: { variable: "font-figure" } }));

const LANDING = {
  range: { from: "2026-09-14T12:00:00+07:00", to: "2026-10-14T12:00:00+07:00", timezone: "Asia/Ho_Chi_Minh" },
  sentimentAnalyzed: 100,
  rows: [
    { term: "giá vé", positive: 62, neutral: 38, negative: 0, total: 100, dominant: "positive", dominantShare: 0.62 },
    { term: "dịch vụ", positive: 1, neutral: 0, negative: 3, total: 4, dominant: "negative", dominantShare: 0.75 },
    { term: "im lặng", positive: 0, neutral: 0, negative: 0, total: 0, dominant: null, dominantShare: null },
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

// jsdom has no layout: give the wall a size; the main sign rect stays 0 (unmeasured → no hole).
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

const boardsIn = () => screen.findAllByRole("img", { name: /^"/ });

// #262, #271 — landing signboard wall (FR-020, FR-149, BR-042, BR-017)
describe("LandingView", () => {
  it("FR-149, BR-042: one board per configured phrase, incl. 0 mentions; full Vietnamese name; not links", async () => {
    setup();
    const boards = await boardsIn();
    expect(boards).toHaveLength(3);
    expect(screen.getByRole("img", { name: '"giá vé" · 62,0% tích cực · 100 lượt nhắc' })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("img", { name: '"im lặng" · chưa ai nhắc' })).toHaveAttribute("data-tone", "blank");
    expect(screen.getByRole("img", { name: /dịch vụ/ })).toHaveAttribute("data-tone", "negative-solid");
    expect(screen.queryByRole("link", { name: /giá vé/ })).not.toBeInTheDocument();
  });

  it("main sign: Vietnamese headline, logo plate, figures over the landing range, never safety (BR-017)", async () => {
    setup();
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Cộng đồng Threads nghĩ gì về bạn?");
    expect(screen.getByRole("img", { name: "How About Me" })).toHaveAttribute(
      "src",
      "/brand/logo-horizontal-primary.svg",
    );
    expect(await screen.findByText("1.284")).toBeInTheDocument();
    expect(screen.getByLabelText("+12,0%")).toHaveTextContent("12,0%");
    expect(screen.getByText("kỳ trước: 1.000")).toBeInTheDocument();
    expect(screen.queryByText(/[↑↓]/)).not.toBeInTheDocument();
    expect(screen.getByText("62,0%")).toBeInTheDocument();
    expect(screen.queryByText(/safety|an toàn/i)).not.toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(`/projects/${P1}/analytics/overview`, {
      params: { compare: "true", from: LANDING.range.from, timezone: LANDING.range.timezone, to: LANDING.range.to },
    });
  });

  it("FR-020: the door plaque links to /overview", async () => {
    setup();
    expect(await screen.findByRole("link", { name: "Vào dashboard" })).toHaveAttribute("href", "/overview");
  });

  it("figures loading → busy list with placeholders", async () => {
    setup({ overview: "pending" });
    await boardsIn();
    expect(screen.getByLabelText("30 ngày qua")).toHaveAttribute("aria-busy", "true");
  });

  it("figures error → hidden, door plaque still there", async () => {
    setup({ overview: "error" });
    await boardsIn();
    await waitFor(() => expect(screen.queryByText("lượt nhắc · 30 ngày")).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Vào dashboard" })).toBeInTheDocument();
  });

  it("landing-terms error → blank placeholder boards only; figures fall back to a 30-day range", async () => {
    setup({ landing: "error" });
    expect(await screen.findByText("1.284")).toBeInTheDocument();
    expect(screen.queryAllByRole("img", { name: /^"/ })).toHaveLength(0);
  });

  it("no phrase configured: admin gets a Settings link, viewers a neutral line", async () => {
    setup({ role: "admin", landing: { ...LANDING, rows: [] } });
    expect(await screen.findByRole("link", { name: "Thêm cụm từ cho landing trong Cài đặt" })).toHaveAttribute(
      "href",
      "/settings/project",
    );
  });

  it("no phrase configured: viewer sees a neutral line only", async () => {
    setup({ role: "viewer", landing: { ...LANDING, rows: [] } });
    expect(await screen.findByText("Chưa có cụm từ nào được cấu hình.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Cài đặt/ })).not.toBeInTheDocument();
  });

  it("NFR-031: reduced motion → boards hang still", async () => {
    reduced = true;
    setup();
    await boardsIn();
    expect(screen.getByRole("main")).toHaveAttribute("data-motion", "reduced");
  });
});
