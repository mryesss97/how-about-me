import { expect, test } from "./fixtures";
import { scan } from "./support/axe";
import { hasSession } from "./support/env";

// #95 / NFR-031..033: axe gate on working screens + responsive smoke at 1280 and 900 (TC-DASH-024).
const PAGES = ["/overview", "/mentions", "/listening-queries", "/system-status"];

test.describe("a11y (admin)", () => {
  test.beforeEach(() => {
    test.skip(!hasSession("admin"), "no admin session: needs E2E_ADMIN_*");
  });

  for (const path of PAGES) {
    for (const width of [1280, 900]) {
      test(`axe: ${path} @${width} has no serious/critical violations`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const { blocking, other } = await scan(page);
        await info.attach("axe-other", { body: other.join("\n") || "none", contentType: "text/plain" });
        expect(blocking).toEqual([]);
        // TC-DASH-024: no horizontal page scroll (tables scroll inside their own container).
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }

  test("axe: mention detail slide-out; Esc returns focus to the row (TC-MEN-020)", async ({ page }) => {
    await page.goto("/mentions");
    const row = page.getByTestId("mention-row").first();
    // The list loads after the page; wait for the first row before deciding the project is empty.
    await row.waitFor({ timeout: 15_000 }).catch(() => {});
    test.skip((await row.count()) === 0, "no mentions in the E2E project");
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    expect((await scan(page)).blocking).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(row).toBeFocused();
  });
});
