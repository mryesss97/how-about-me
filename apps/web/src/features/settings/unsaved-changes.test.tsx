import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnsavedChangesProvider, useRegisterDirty, useUnsavedChanges } from "./unsaved-changes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function Form({ id, dirty }: { id: string; dirty: boolean }) {
  useRegisterDirty(id, dirty);
  return null;
}
function Probe() {
  return <span data-testid="any">{String(useUnsavedChanges().anyDirty)}</span>;
}
const tree = (a: boolean, b: boolean | null) => (
  <UnsavedChangesProvider>
    <Form id="a" dirty={a} />
    {b === null ? null : <Form id="b" dirty={b} />}
    <Probe />
  </UnsavedChangesProvider>
);
const fireUnload = () => {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};

// #347: unsaved-changes registry + beforeunload
describe("UnsavedChangesProvider", () => {
  it("anyDirty follows registered boards and unmount clears an id", () => {
    const { rerender } = render(tree(false, false));
    expect(screen.getByTestId("any")).toHaveTextContent("false");
    rerender(tree(false, true));
    expect(screen.getByTestId("any")).toHaveTextContent("true");
    rerender(tree(false, null));
    expect(screen.getByTestId("any")).toHaveTextContent("false");
  });

  it("beforeunload is blocked only while dirty", () => {
    const { rerender, unmount } = render(tree(true, null));
    expect(fireUnload()).toBe(true);
    rerender(tree(false, null));
    expect(fireUnload()).toBe(false);
    unmount();
  });

  it("outside a provider the hooks are inert", () => {
    render(
      <>
        <Form id="x" dirty />
        <Probe />
      </>,
    );
    expect(screen.getByTestId("any")).toHaveTextContent("false");
  });
});
