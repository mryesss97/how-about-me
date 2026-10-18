import { expect, test } from "./fixtures";
import { hasSession } from "./support/env";
import { settle } from "./support/settle";

// #325, BR-017: one current item that follows the URL; mobile drawer closes on navigation; skip link.
test.describe("shell navigation", () => {
  test.beforeEach(() => {
    test.skip(!hasSession("admin"), "no admin session: needs E2E_ADMIN_* and the wired login form (T-032)");
  });

  test("desktop: exactly one aria-current that matches the URL", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/overview");
    await settle(page);
    const sidebar = page.locator("aside:visible");
    for (const [label, path] of [
      ["Bài nhắc", "/mentions"],
      ["Cần xem lại", "/reviews"],
      ["Cài đặt", "/settings/project"],
      ["Tổng quan", "/overview"],
    ] as const) {
      await sidebar.getByRole("link", { name: label }).click();
      // First visit of a route compiles on a dev server; allow it.
      await expect(page).toHaveURL(new RegExp(path), { timeout: 15_000 });
      await settle(page);
      const current = sidebar.locator('[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toContainText(label, { ignoreCase: true });
    }
    await page.goto("/settings/members");
    await expect(sidebar.locator('[aria-current="page"]')).toContainText("Cài đặt", { ignoreCase: true });
  });

  test("mobile: drawer closes on navigation, header sticky, 44 px targets", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mentions");
    await settle(page);
    const menu = page.getByRole("button", { name: "Mở menu điều hướng" });
    expect((await menu.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((await menu.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(44);

    await page.mouse.wheel(0, 2000);
    await expect(menu).toBeInViewport();

    await menu.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "Đóng menu điều hướng" });
    await expect(close).toHaveCount(1);
    expect((await close.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    const link = dialog.getByRole("link", { name: "Tổng quan" });
    expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    await link.click();
    await expect(page).toHaveURL(/\/overview/, { timeout: 15_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("skip link is the first tab stop and moves focus into main", async ({ page }) => {
    await page.goto("/overview");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Bỏ qua tới nội dung chính" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();
  });
});
