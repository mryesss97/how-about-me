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
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/auth/use-current-project", () => ({ useCurrentProject: () => ({ project: { id: PID } }) }));

beforeEach(() => {
  apiFetch.mockReset();
  push.mockReset();
});

// #276: mentions of one phrase on its detail page (BR-042, #273)
describe("TermMentions", () => {
  it("lists mentions with the term and opens the mention detail page", async () => {
    const m = mentionFixture();
    apiFetch.mockResolvedValue({ items: [m], nextCursor: null, totalCount: 1 });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NuqsTestingAdapter searchParams="?preset=30d">
          <TermMentions term="giá vé" />
        </NuqsTestingAdapter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("1 bài nhắc")).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(`/projects/${PID}/mentions`, {
      params: expect.objectContaining({ term: "giá vé", count: "true" }),
    });
    expect(screen.getByRole("heading", { name: 'Bài nhắc tới "giá vé"' })).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId("mention-row"));
    expect(push).toHaveBeenCalledWith(`/mentions/${m.id}`);
  });
});
