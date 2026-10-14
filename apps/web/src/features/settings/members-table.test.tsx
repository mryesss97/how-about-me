import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { P1 } from "@/features/auth/test-utils";
import { ApiError } from "@/lib/api/client";
import { MembersTable } from "./members-table";
import { ADMIN_ID, memberData, VIEWER_ID } from "./test-fixtures";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));

const OTHER_ADMIN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);
const lastAdmin = () => new ApiError(409, "LAST_ADMIN", "Last admin", "req-1");

const renderTable = (members = [memberData(ADMIN_ID, "admin", "a@x.co"), memberData(VIEWER_ID, "viewer", "v@x.co")]) =>
  render(<MembersTable pid={P1} members={members} timezone="Asia/Ho_Chi_Minh" currentUserId={ADMIN_ID} />, { wrapper });

beforeEach(() => {
  apiFetch.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

// TC-PROJ-014, FR-033..FR-035
describe("MembersTable", () => {
  it("FR-034: changing a role PATCHes the member and refetches the list", async () => {
    apiFetch.mockResolvedValue(memberData(VIEWER_ID, "analyst", "v@x.co"));
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    renderTable();
    fireEvent.change(screen.getByLabelText("Vai trò của v@x.co"), { target: { value: "analyst" } });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project", P1, "members"] }));
    const [path, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/projects/${P1}/members/${VIEWER_ID}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ role: "analyst" });
  });

  it("#281: the role toast uses the Vietnamese label while the payload keeps the API enum", async () => {
    apiFetch.mockResolvedValue(memberData(VIEWER_ID, "analyst", "v@x.co"));
    renderTable();
    fireEvent.change(screen.getByLabelText("Vai trò của v@x.co"), { target: { value: "analyst" } });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("v@x.co giờ là Phân tích"));
    const [, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ role: "analyst" });
  });

  it("FR-035: 409 LAST_ADMIN on role change shows the error and reverts the select", async () => {
    apiFetch.mockRejectedValue(lastAdmin());
    const members = [memberData(ADMIN_ID, "admin", "a@x.co"), memberData(OTHER_ADMIN, "admin", "b@x.co")];
    renderTable(members);
    const select = screen.getByLabelText("Vai trò của b@x.co");
    fireEvent.change(select, { target: { value: "viewer" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Dự án phải còn ít nhất một quản trị viên.");
    await waitFor(() => expect(select).toHaveValue("admin"));
  });

  it("locks the last admin's role and Remove as a hint", () => {
    renderTable();
    expect(screen.getByLabelText("Vai trò của a@x.co")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xoá a@x.co" })).toBeDisabled();
  });

  it("FR-034: Remove asks for confirmation; Cancel does not call DELETE", async () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Xoá v@x.co" }));
    expect(await screen.findByText("Xoá v@x.co?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(screen.queryByText("Xoá v@x.co?")).not.toBeInTheDocument());
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("FR-034: confirming Remove sends DELETE", async () => {
    apiFetch.mockResolvedValue(undefined);
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: "Xoá v@x.co" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xoá" }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(`/projects/${P1}/members/${VIEWER_ID}`, { method: "DELETE" }),
    );
  });

  it("FR-035: 409 LAST_ADMIN on remove shows the error", async () => {
    apiFetch.mockRejectedValue(lastAdmin());
    renderTable([memberData(ADMIN_ID, "admin", "a@x.co"), memberData(OTHER_ADMIN, "admin", "b@x.co")]);
    fireEvent.click(screen.getByRole("button", { name: "Xoá b@x.co" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xoá" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Dự án phải còn ít nhất một quản trị viên.");
  });
});
