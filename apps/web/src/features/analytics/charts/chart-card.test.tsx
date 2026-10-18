import { act, fireEvent, render, screen } from "@testing-library/react";
import { seriousViolations } from "@/test/axe";
import { describe, expect, it } from "vitest";
import { ChartCard } from "./chart-card";
import { openTable } from "./table-utils.test-utils";

const table = {
  columns: ["Thời gian", "Lượt nhắc"],
  rows: [
    ["06/10", "5"],
    ["07/10", "0"],
  ],
};

/** React Aria fires `onPress` on keyup after keydown. */
async function press(el: HTMLElement, key: string) {
  await act(async () => {
    fireEvent.keyDown(el, { key });
    fireEvent.keyUp(el, { key });
  });
}

describe("ChartCard", () => {
  it("TC-DASH-022 / NFR-032: keyboard toggles to a table with the same numbers and aria-pressed", async () => {
    render(
      <ChartCard title="Lượt nhắc theo thời gian" table={table}>
        <div>chart</div>
      </ChartCard>,
    );
    const toggle = screen.getByRole("button", { name: "Xem dạng bảng" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(document.body, { key: "Tab" });
    await act(async () => toggle.focus());
    expect(toggle).toHaveFocus();
    await press(toggle, "Enter");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("grid", { name: "Lượt nhắc theo thời gian (bảng)" })).toBeInTheDocument();
    expect(screen.getByText("07/10")).toBeInTheDocument();
    expect(screen.queryByText("chart")).not.toBeInTheDocument();
    await press(screen.getByRole("button", { name: "Xem dạng bảng" }), " ");
    expect(screen.getByText("chart")).toBeInTheDocument();
  });

  it("BR-032: empty → explicit empty state, no toggle", () => {
    render(
      <ChartCard title="X" table={table} isEmpty>
        <div>chart</div>
      </ChartCard>,
    );
    expect(screen.getByText("Không có lượt nhắc trong khoảng này")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xem dạng bảng" })).not.toBeInTheDocument();
  });

  it("shows error with retry", async () => {
    let retried = false;
    render(
      <ChartCard
        title="X"
        table={table}
        error={{ message: "boom", requestId: "req-1" }}
        onRetry={() => (retried = true)}
      >
        <div>chart</div>
      </ChartCard>,
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /thử lại/i })));
    expect(retried).toBe(true);
  });
});

describe("ChartCard viewToggle / toolbar / footer (#222)", () => {
  it("NFR-032: segmented toggle switches to table; toolbar in both modes; footer only when ready", async () => {
    const { rerender } = render(
      <ChartCard
        title="Map"
        table={table}
        viewToggle={{ chart: "Bong bóng", table: "Bảng dữ liệu" }}
        toolbar={<p>chips</p>}
        footer={<p>legend</p>}
      >
        <div>chart</div>
      </ChartCard>,
    );
    expect(screen.queryByRole("button", { name: "Xem dạng bảng" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Bong bóng" })).toHaveAttribute("aria-checked", "true");
    await act(async () => fireEvent.click(screen.getByRole("radio", { name: "Bảng dữ liệu" })));
    expect(screen.getByRole("grid", { name: "Map (bảng)" })).toBeInTheDocument();
    expect(screen.getByText("chips")).toBeInTheDocument();
    expect(screen.getByText("legend")).toBeInTheDocument();
    rerender(
      <ChartCard
        title="Map"
        table={table}
        isLoading
        viewToggle={{ chart: "Bong bóng", table: "Bảng dữ liệu" }}
        toolbar={<p>chips</p>}
        footer={<p>legend</p>}
      >
        <div>chart</div>
      </ChartCard>,
    );
    expect(screen.queryByText("chips")).toBeNull();
    expect(screen.queryByText("legend")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

describe("ChartCard — axe (#95, TC-DASH-022, NFR-032)", () => {
  it("has no serious/critical axe violations in chart and table mode", async () => {
    const { container } = render(
      <main>
        <ChartCard title="Lượt nhắc theo thời gian" table={table}>
          <div>chart</div>
        </ChartCard>
      </main>,
    );
    expect(await seriousViolations(container)).toEqual([]);
    await press(screen.getByRole("button", { name: "Xem dạng bảng" }), "Enter");
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(await seriousViolations(container)).toEqual([]);
  });
});

describe("ChartCard cellHrefs (#335)", () => {
  it("FR-142: cellHrefs links individual cells; null cells stay text", async () => {
    render(
      <ChartCard
        title="T"
        table={{ columns: ["A", "B"], rows: [["x", "1"]], cellHrefs: [[null, "/mentions?b=1"]], rowHrefs: ["/row"] }}
      >
        <div />
      </ChartCard>,
    );
    await openTable();
    expect(screen.getByRole("link", { name: "1" })).toHaveAttribute("href", "/mentions?b=1");
    expect(screen.getByRole("link", { name: "x" })).toHaveAttribute("href", "/row");
  });
});
