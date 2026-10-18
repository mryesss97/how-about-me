import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { mentionFixture } from "./fixtures.test-utils";
import { TermMentions } from "./term-mentions";

const PID = "11111111-1111-4111-8111-111111111111";
const apiFetch = vi.fn();
const push = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/terms/gi%C3%A1%20v%C3%A9",
  useSearchParams: () => new URLSearchParams("preset=30d"),
}));
vi.mock("@/features/auth/use-current-project", () => ({ useCurrentProject: () => ({ project: { id: PID } }) }));

beforeEach(() => {
  apiFetch.mockReset();
  push.mockReset();
});

const COUNTS = { positive: 15, neutral: 15, negative: 8 };
const renderIt = (search = "?preset=30d") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NuqsTestingAdapter searchParams={search}>
        <TermMentions term="giá vé" counts={COUNTS} total={38} />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
const lastListParams = () =>
  (apiFetch.mock.calls.at(-1)?.[1] as { params: Record<string, string> } | undefined)?.params ?? {};

// #276: mentions of one phrase on its detail page (BR-042, #273)
describe("TermMentions", () => {
  it("lists mentions with the term and opens the mention detail page", async () => {
    const m = mentionFixture();
    apiFetch.mockResolvedValue({ items: [m], nextCursor: null, totalCount: 1 });
    renderIt();
    await screen.findByRole("link", { name: /Bài nhắc của/ });
    expect(apiFetch).toHaveBeenCalledWith(`/projects/${PID}/mentions`, {
      params: expect.objectContaining({ term: "giá vé", count: "true" }),
    });
    expect(screen.getByRole("heading", { name: 'Bài nhắc tới "giá vé"' })).toBeInTheDocument();
    // #326: the row is a real link to the full page (no slide-out on /terms).
    const link = await screen.findByRole("link", { name: /Bài nhắc của/ });
    // #331: the detail page's back link returns to this phrase page with its range.
    const url = new URL(link.getAttribute("href") ?? "", "http://x");
    expect(url.pathname).toBe(`/mentions/${m.id}`);
    expect(url.searchParams.get("back")).toBe("/terms/gi%C3%A1%20v%C3%A9?preset=30d");
    expect(fireEvent.click(link)).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it("#333: tabs show hero counts; picking one sends sentiment to the list only", async () => {
    apiFetch.mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 });
    renderIt();
    for (const name of ["Tất cả · 38", "Tiêu cực · 8", "Tích cực · 15", "Trung tính · 15"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Tất cả · 38" })).toHaveAttribute("aria-pressed", "true");
    await screen.findByText(/./, { selector: "h2" });
    expect(lastListParams().sentiment).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Tiêu cực · 8" }));
    await vi.waitFor(() => expect(lastListParams().sentiment).toBe("negative"));
    expect(screen.getByRole("button", { name: "Tiêu cực · 8" })).toHaveAttribute("aria-pressed", "true");
  });

  it("#333 / FR-142: exactly one /mentions link, with range, term and the tab as sentiment", () => {
    apiFetch.mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 });
    renderIt("?preset=30d&list=negative");
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/mentions?"));
    expect(links).toHaveLength(1);
    const url = new URL(links[0]?.getAttribute("href") ?? "", "http://x");
    expect(url.searchParams.get("preset")).toBe("custom");
    expect(url.searchParams.get("term")).toBe("giá vé");
    expect(url.searchParams.get("sentiment")).toBe("negative");
    expect(url.searchParams.get("list")).toBeNull();
  });
});
