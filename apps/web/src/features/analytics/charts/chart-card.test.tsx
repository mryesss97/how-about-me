import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartCard } from "./chart-card";

const table = {
  columns: ["Time", "Mentions"],
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
      <ChartCard title="Mentions over time" table={table}>
        <div>chart</div>
      </ChartCard>,
    );
    const toggle = screen.getByRole("button", { name: "View as table" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(document.body, { key: "Tab" });
    await act(async () => toggle.focus());
    expect(toggle).toHaveFocus();
    await press(toggle, "Enter");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("grid", { name: "Mentions over time (table)" })).toBeInTheDocument();
    expect(screen.getByText("07/10")).toBeInTheDocument();
    expect(screen.queryByText("chart")).not.toBeInTheDocument();
    await press(screen.getByRole("button", { name: "View as table" }), " ");
    expect(screen.getByText("chart")).toBeInTheDocument();
  });

  it("BR-032: empty → explicit empty state, no toggle", () => {
    render(
      <ChartCard title="X" table={table} isEmpty>
        <div>chart</div>
      </ChartCard>,
    );
    expect(screen.getByText("No mentions in this range")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View as table" })).not.toBeInTheDocument();
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
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /retry/i })));
    expect(retried).toBe(true);
  });
});
