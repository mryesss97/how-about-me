import type * as ClientModule from "@/lib/api/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
// #347: the table and the mobile list are both in the DOM (CSS picks one); scope queries to the table.
const table = () => within(screen.getByRole("table"));
const list = () => within(screen.getByRole("list", { name: "Thành viên" }));
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
    fireEvent.change(table().getByLabelText("Vai trò của v@x.co"), { target: { value: "analyst" } });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project", P1, "members"] }));
    const [path, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe(`/projects/${P1}/members/${VIEWER_ID}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ role: "analyst" });
  });

  it("#281: the role toast uses the Vietnamese label while the payload keeps the API enum", async () => {
    apiFetch.mockResolvedValue(memberData(VIEWER_ID, "analyst", "v@x.co"));
    renderTable();
    fireEvent.change(table().getByLabelText("Vai trò của v@x.co"), { target: { value: "analyst" } });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("v@x.co giờ là Phân tích"));
    const [, init] = apiFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ role: "analyst" });
  });

  it("FR-035: 409 LAST_ADMIN on role change shows the error and reverts the select", async () => {
    apiFetch.mockRejectedValue(lastAdmin());
    const members = [memberData(ADMIN_ID, "admin", "a@x.co"), memberData(OTHER_ADMIN, "admin", "b@x.co")];
    renderTable(members);
    const select = table().getByLabelText("Vai trò của b@x.co");
    fireEvent.change(select, { target: { value: "viewer" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Dự án phải còn ít nhất một quản trị viên.");
    await waitFor(() => expect(select).toHaveValue("admin"));
  });

  it("locks the last admin's role and Remove as a hint", () => {
    renderTable();
    expect(table().getByLabelText("Vai trò của a@x.co")).toBeDisabled();
    expect(table().getByRole("button", { name: "Xoá a@x.co" })).toBeDisabled();
  });

  it("#347 / FR-035: the sole admin's lock reason is visible text tied to its controls", () => {
    renderTable();
    const hint = table().getByText("Quản trị viên duy nhất — không thể đổi vai trò hay xoá.");
    expect(table().getByLabelText("Vai trò của a@x.co")).toHaveAttribute("aria-describedby", hint.id);
    expect(table().getByRole("button", { name: "Xoá a@x.co" })).toHaveAttribute("aria-describedby", hint.id);
    expect(table().getByLabelText("Vai trò của a@x.co")).not.toHaveAttribute("title");
    expect(table().getByLabelText("Vai trò của v@x.co")).not.toHaveAttribute("aria-describedby");
  });

  it("#347: two admins → no lock hint", () => {
    renderTable([memberData(ADMIN_ID, "admin", "a@x.co"), memberData(OTHER_ADMIN, "admin", "b@x.co")]);
    expect(screen.queryByText(/Quản trị viên duy nhất/)).toBeNull();
  });

  it("#347: marks the current user's row with (bạn) only", () => {
    renderTable();
    const rows = table().getAllByRole("row");
    expect(within(rows[1]).getByText("(bạn)")).toBeInTheDocument();
    expect(within(rows[2]).queryByText("(bạn)")).toBeNull();
  });

  it("#347: the stacked mobile list carries the same controls and lock", () => {
    renderTable();
    expect(list().getAllByRole("listitem")).toHaveLength(2);
    expect(list().getByLabelText("Vai trò của a@x.co")).toBeDisabled();
    expect(list().getByRole("button", { name: "Xoá v@x.co" })).toBeEnabled();
  });

  it("FR-034: Remove asks for confirmation; Cancel does not call DELETE", async () => {
    renderTable();
    fireEvent.click(table().getByRole("button", { name: "Xoá v@x.co" }));
    expect(await screen.findByText("Xoá v@x.co?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(screen.queryByText("Xoá v@x.co?")).not.toBeInTheDocument());
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("FR-034: confirming Remove sends DELETE", async () => {
    apiFetch.mockResolvedValue(undefined);
    renderTable();
    fireEvent.click(table().getByRole("button", { name: "Xoá v@x.co" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xoá" }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(`/projects/${P1}/members/${VIEWER_ID}`, { method: "DELETE" }),
    );
  });

  it("FR-035: 409 LAST_ADMIN on remove shows the error", async () => {
    apiFetch.mockRejectedValue(lastAdmin());
    renderTable([memberData(ADMIN_ID, "admin", "a@x.co"), memberData(OTHER_ADMIN, "admin", "b@x.co")]);
    fireEvent.click(table().getByRole("button", { name: "Xoá b@x.co" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xoá" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Dự án phải còn ít nhất một quản trị viên.");
  });
});
