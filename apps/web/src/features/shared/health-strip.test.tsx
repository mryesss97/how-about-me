import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { meFixture, P1, projectFixture, Providers } from "@/features/auth/test-utils";
import { seriousViolations } from "@/test/axe";
import { healthFixture } from "./health-fixture.test-utils";
import { CollectionHealthProvider, HealthStrip } from "./health-strip";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
let pathname = "/overview";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

function mockApi(role: "admin" | "analyst" | "viewer", status = healthFixture({ threads: { status: "expired" } })) {
  apiFetch.mockImplementation((path: string) =>
    Promise.resolve(path.endsWith("/system-status") ? status : meFixture([projectFixture(P1, role)])),
  );
}

const Shell = ({ children }: { children: ReactNode }) => (
  <Providers>
    <CollectionHealthProvider>{children}</CollectionHealthProvider>
  </Providers>
);

// #345 (flows-4): one strip under the fascia; link for admins only (BR-033).
describe("HealthStrip (#345)", () => {
  beforeEach(() => {
    pathname = "/overview";
    apiFetch.mockReset();
  });

  it("renders nothing without the provider", () => {
    const { container } = render(<HealthStrip />, { wrapper: Providers });
    expect(container).toBeEmptyDOMElement();
  });

  it("admin: title + Mở Kết nối plaque; not a live region; no axe violations", async () => {
    mockApi("admin");
    const { container } = render(<HealthStrip />, { wrapper: Shell });
    expect(await screen.findByText("Kết nối Threads cần được xử lý.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở Kết nối" })).toHaveAttribute("href", "/settings/integrations");
    expect(screen.getByRole("region", { name: "Tình trạng thu thập" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it("viewer: no link, told to contact the admin", async () => {
    mockApi("viewer");
    render(<HealthStrip />, { wrapper: Shell });
    expect(await screen.findByText(/Hãy liên hệ quản trị dự án/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it.each(["/system-status", "/settings/integrations"])("hidden on %s", async (p) => {
    pathname = p;
    mockApi("admin");
    render(
      <>
        <HealthStrip />
        <span>ready</span>
      </>,
      { wrapper: Shell },
    );
    await screen.findByText("ready");
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Kết nối Threads cần được xử lý.")).toBeNull();
  });

  it("healthy → nothing", async () => {
    mockApi("admin", healthFixture());
    const { container } = render(<HealthStrip />, { wrapper: Shell });
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
