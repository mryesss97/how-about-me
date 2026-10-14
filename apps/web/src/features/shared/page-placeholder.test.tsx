import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PagePlaceholder } from "./page-placeholder";

const tasks = [
  { id: "T-046", label: "Bảng truy vấn" },
  { id: "T-047", label: "Ngăn kéo & thao tác" },
  { id: "T-141", label: "Lấy dữ liệu cũ (P1)" },
];

// #279: signboard placeholder; Vietnamese copy, task plates on an enamel board.
describe("PagePlaceholder", () => {
  it("renders the page title as h1 and the 'Sẽ làm trong' board", () => {
    render(<PagePlaceholder title="Truy vấn theo dõi" description="Mô tả" tasks={tasks} />);
    expect(screen.getByRole("heading", { level: 1, name: "Truy vấn theo dõi" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Sẽ làm trong" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Sẽ làm trong" })).toBeTruthy();
  });

  it("renders one task plate per task with id and Vietnamese label", () => {
    render(<PagePlaceholder title="Truy vấn theo dõi" description="Mô tả" tasks={tasks} />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toBe("T-046 · Bảng truy vấn");
    expect(items[2]?.className).toContain("task-plate");
    expect(screen.getByText(/Lấy dữ liệu cũ \(P1\)/)).toBeTruthy();
  });
});
