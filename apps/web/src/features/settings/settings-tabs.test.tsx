import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { meFixture, P1, projectFixture, Providers } from "@/features/auth/test-utils";
import { useRole } from "@/features/auth/use-role";
import { SettingsTabs } from "./settings-tabs";
import { UnsavedChangesProvider, useRegisterDirty } from "./unsaved-changes";

const apiFetch = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/settings/members", useRouter: () => ({ push }) }));
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

/** Renders the loaded role so tests can wait for `/me` instead of sleeping. */
function RoleProbe() {
  return <span data-testid="role">{useRole().role ?? ""}</span>;
}
const renderTabs = () =>
  render(
    <>
      <SettingsTabs />
      <RoleProbe />
    </>,
    { wrapper: Providers },
  );

// FR-018, TC-AUTH-014
describe("SettingsTabs", () => {
  it("hides Members and Integrations from a viewer", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "viewer")]));
    renderTabs();
    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent("viewer"));
    expect(screen.getByRole("link", { name: "Dự án" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Kết nối" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Thành viên" })).not.toBeInTheDocument();
  });

  it("shows every tab to an admin", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin")]));
    renderTabs();
    expect(await screen.findByRole("link", { name: "Thành viên" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kết nối" })).toBeInTheDocument();
  });

  it("marks the tab for the current path as active", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin")]));
    renderTabs();
    expect(await screen.findByRole("link", { name: "Thành viên" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dự án" })).not.toHaveAttribute("aria-current");
  });

  it.each(["admin", "analyst", "viewer"] as const)("FR-190: %s sees the Analysis tab", async (role) => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, role)]));
    renderTabs();
    await waitFor(() => expect(screen.getByTestId("role")).toHaveTextContent(role));
    expect(screen.getByRole("link", { name: "Phân tích" })).toBeInTheDocument();
  });
});

function DirtyProbe({ dirty }: { dirty: boolean }) {
  useRegisterDirty("probe", dirty);
  return null;
}
const renderGuarded = (dirty: boolean) =>
  render(
    <UnsavedChangesProvider>
      <SettingsTabs />
      <DirtyProbe dirty={dirty} />
    </UnsavedChangesProvider>,
    { wrapper: Providers },
  );

// #347: Settings tab guard
describe("SettingsTabs unsaved-changes guard", () => {
  it("clean: tab click is not intercepted", async () => {
    push.mockReset();
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin")]));
    renderGuarded(false);
    fireEvent.click(await screen.findByRole("link", { name: "Dự án" }));
    expect(screen.queryByText("Bỏ thay đổi chưa lưu?")).toBeNull();
  });

  it("dirty: tab click opens the dialog; Huỷ stays, Bỏ thay đổi navigates", async () => {
    push.mockReset();
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin")]));
    renderGuarded(true);
    fireEvent.click(await screen.findByRole("link", { name: "Dự án" }));
    expect(await screen.findByText("Bỏ thay đổi chưa lưu?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(screen.queryByText("Bỏ thay đổi chưa lưu?")).toBeNull());
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Dự án" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bỏ thay đổi" }));
    expect(push).toHaveBeenCalledWith("/settings/project");
  });

  it("dirty: clicking the current tab does nothing", async () => {
    apiFetch.mockResolvedValue(meFixture([projectFixture(P1, "admin")]));
    renderGuarded(true);
    fireEvent.click(await screen.findByRole("link", { name: "Thành viên" }));
    expect(screen.queryByText("Bỏ thay đổi chưa lưu?")).toBeNull();
  });
});
