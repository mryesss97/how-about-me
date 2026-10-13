import { act, fireEvent, screen } from "@testing-library/react";

/** Switches a ChartCard to table mode and returns the rows' cell texts (header row first). */
export async function openTable(): Promise<string[][]> {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "View as table" })));
  const grid = screen.getByRole("grid");
  return Array.from(grid.querySelectorAll("tr"))
    .map((row) => Array.from(row.querySelectorAll("th, td")).map((c) => (c.textContent ?? "").trim()))
    .filter((cells) => cells.length > 0);
}
