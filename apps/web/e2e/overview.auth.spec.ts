import { expect, test } from "./fixtures";
import { hasSession } from "./support/env";

test("admin sees overview", async ({ page }) => {
  test.skip(!hasSession("admin"), "no admin session: needs E2E_ADMIN_* and the wired login form (T-032)");
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
});
