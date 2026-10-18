import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavigationHeader, useMobileNav } from "./mobile-header";

let pathname = "/overview";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

function CloseFromContext() {
  const nav = useMobileNav();
  return (
    <button type="button" onClick={() => nav?.close()}>
      Đăng xuất
    </button>
  );
}

const ui = () => (
  <MobileNavigationHeader>
    <Link href="/mentions">Bài nhắc</Link>
    <CloseFromContext />
  </MobileNavigationHeader>
);

async function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Mở menu điều hướng" }));
  return screen.findByRole("dialog");
}

// #325: the mobile drawer closes on navigation.
describe("MobileNavigationHeader", () => {
  beforeEach(() => {
    pathname = "/overview";
  });

  it("closes when the pathname changes", async () => {
    const { rerender } = render(ui());
    await openMenu();
    pathname = "/mentions";
    rerender(ui());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes when a link inside the drawer is clicked (same page too)", async () => {
    render(ui());
    const dialog = await openMenu();
    fireEvent.click(dialog.querySelector("a[href='/mentions']") as HTMLAnchorElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes through the context (sign-out)", async () => {
    render(ui());
    await openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("has a single close button", async () => {
    render(ui());
    await openMenu();
    expect(screen.getAllByRole("button", { name: "Đóng menu điều hướng" })).toHaveLength(1);
  });
});
