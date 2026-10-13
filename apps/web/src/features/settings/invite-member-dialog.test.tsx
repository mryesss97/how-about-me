import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { P1 } from "@/features/auth/test-utils";
import { ApiError } from "@/lib/api/client";
import { InviteMemberDialog } from "./invite-member-dialog";
import { memberData, VIEWER_ID } from "./test-fixtures";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const onClose = vi.fn();
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);
const renderDialog = () => render(<InviteMemberDialog pid={P1} isOpen onClose={onClose} />, { wrapper });
const typeEmail = (v: string) =>
  fireEvent.change(screen.getByRole("textbox", { name: /Email/ }), { target: { value: v } });

beforeEach(() => {
  apiFetch.mockReset();
  onClose.mockReset();
});

// FR-033, TC-PROJ-014
describe("InviteMemberDialog", () => {
  it("rejects an invalid email inline without calling the API", async () => {
    renderDialog();
    typeEmail("not-an-email");
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("FR-033: POSTs {email, role} and closes on success", async () => {
    apiFetch.mockResolvedValue(memberData(VIEWER_ID, "analyst", "new@x.co"));
    renderDialog();
    typeEmail("new@x.co");
    fireEvent.change(screen.getByRole("combobox", { name: /Role/ }), { target: { value: "analyst" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [path, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/projects/${P1}/members`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ email: "new@x.co", role: "analyst" });
  });

  it("shows 409 MEMBER_EXISTS inline under the email field", async () => {
    apiFetch.mockRejectedValue(new ApiError(409, "MEMBER_EXISTS", "exists", "req-2"));
    renderDialog();
    typeEmail("dup@x.co");
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(await screen.findByText("This email is already a member.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
