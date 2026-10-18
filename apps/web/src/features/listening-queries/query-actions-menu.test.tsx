import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { queryFixture } from "./fixtures.test-utils";
import { QueryActionsMenu, mentionsHrefFor } from "./query-actions-menu";

const handlers = {
  onEdit: vi.fn(),
  onRun: vi.fn(),
  onBackfill: vi.fn(),
  onToggle: vi.fn(),
  onDelete: vi.fn(),
  onRestore: vi.fn(),
};

function open(isAdmin: boolean, q = queryFixture()) {
  render(<QueryActionsMenu query={q} isAdmin={isAdmin} {...handlers} />);
  fireEvent.click(screen.getByRole("button", { name: `Thao tác cho ${q.displayName}` }));
  return q;
}

describe("QueryActionsMenu", () => {
  it("FR-062 / TC-LQ-020: 'Xem bài nhắc' links to /mentions?queryIds=<id>", () => {
    const q = open(false);
    expect(mentionsHrefFor(q.id)).toBe(`/mentions?queryIds=${q.id}`);
    expect(screen.getByRole("menuitem", { name: "Xem bài nhắc" })).toHaveAttribute("href", mentionsHrefFor(q.id));
  });

  it("TC-LQ-021 / FR-018 / BR-033: viewer sees only 'Xem bài nhắc'", () => {
    open(false);
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Chạy ngay" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Xoá" })).not.toBeInTheDocument();
  });

  it("TC-LQ-021 / #340 ops-6: admin menu is grouped, has no Tắt/Bật, and Xoá is destructive", () => {
    const q = open(true);
    expect(screen.getAllByRole("menuitem").map((e) => e.textContent)).toEqual([
      "Xem bài nhắc",
      "Sửa",
      "Chạy ngay",
      "Lấy dữ liệu cũ",
      "Xoá",
    ]);
    expect(screen.getAllByRole("separator")).toHaveLength(2);
    expect(screen.getByText("Xoá")).toHaveClass("text-error-primary");
    fireEvent.click(screen.getByRole("menuitem", { name: "Chạy ngay" }));
    expect(handlers.onRun).toHaveBeenCalledWith(q);
  });

  it("#340: 'Xoá' calls onDelete", () => {
    const q = open(true);
    fireEvent.click(screen.getByRole("menuitem", { name: "Xoá" }));
    expect(handlers.onDelete).toHaveBeenCalledWith(q);
  });

  it("#340 ops-2: the trigger is a 44px target", () => {
    const q = queryFixture();
    render(<QueryActionsMenu query={q} isAdmin={false} />);
    expect(screen.getByRole("button", { name: `Thao tác cho ${q.displayName}` })).toHaveClass("size-11");
  });

  it("admin on a deleted query sees only Khôi phục besides 'Xem bài nhắc'", () => {
    open(true, queryFixture({ deletedAt: "2026-10-13T00:00:00.000Z" }));
    expect(screen.getAllByRole("menuitem").map((e) => e.textContent)).toEqual(["Xem bài nhắc", "Khôi phục"]);
  });

  it("FR-063 / BR-033: Backfill only for admins, on enabled non-deleted queries", () => {
    const q = open(true);
    fireEvent.click(screen.getByRole("menuitem", { name: "Lấy dữ liệu cũ" }));
    expect(handlers.onBackfill).toHaveBeenCalledWith(q);
  });

  it("BR-033: viewer gets no Backfill item", () => {
    open(false);
    expect(screen.queryByRole("menuitem", { name: "Lấy dữ liệu cũ" })).not.toBeInTheDocument();
  });

  it("no Backfill for a disabled query", () => {
    open(true, queryFixture({ enabled: false }));
    expect(screen.queryByRole("menuitem", { name: "Lấy dữ liệu cũ" })).not.toBeInTheDocument();
  });

  it("admin items without a handler are not rendered (#43 wires them)", () => {
    const q = queryFixture();
    render(<QueryActionsMenu query={q} isAdmin />);
    fireEvent.click(screen.getByRole("button", { name: `Thao tác cho ${q.displayName}` }));
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  });
});
