import type * as ClientModule from "@/lib/api/client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { meFixture, P1, projectFixture, Providers } from "@/features/auth/test-utils";
import { ProjectSettings } from "./project-settings";
import { projectData } from "./test-fixtures";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

// #347 / #261: saving the Project section never silently drops the Landing draft.
describe("ProjectSettings", () => {
  it("keeps the Landing draft when the Project section is saved", async () => {
    apiFetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/me") return Promise.resolve(meFixture([projectFixture(P1, "admin")]));
      if (init?.method === "PATCH") return Promise.resolve(projectData({ name: "Tên mới" }));
      return Promise.resolve(projectData());
    });
    render(<ProjectSettings />, { wrapper: Providers });
    const name = await screen.findByRole("textbox", { name: /Tên dự án/ });
    const tags = screen.getByPlaceholderText("Thêm cụm từ rồi nhấn Enter");
    fireEvent.change(tags, { target: { value: "giá vé" } });
    fireEvent.keyDown(tags, { key: "Enter" });
    expect(screen.getByText("giá vé")).toBeInTheDocument();

    fireEvent.change(name, { target: { value: "Tên mới" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Lưu" })[0]);
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Tên dự án/ })).toHaveValue("Tên mới"));
    await waitFor(() => expect(screen.getAllByText("Chưa có thay đổi")).toHaveLength(1));
    expect(screen.getByText("giá vé")).toBeInTheDocument();
  });

  it("#348: while loading it shows a board skeleton with the real section title", async () => {
    apiFetch.mockImplementation(() => new Promise(() => {}));
    render(<ProjectSettings />, { wrapper: Providers });
    const title = screen.getByRole("heading", { level: 2, name: "Dự án" });
    const board = title.closest(".operate-board");
    expect(board).not.toBeNull();
    expect(board?.querySelector("[aria-busy='true']")).not.toBeNull();
  });
});
