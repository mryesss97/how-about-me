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

  test("axe: mention detail slide-out via ?item=; Esc/Back close, focus returns to the row (TC-MEN-009, TC-MEN-020, #326)", async ({
    page,
  }) => {
    const serverErrors: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("/mentions");
    const row = page.getByTestId("mention-row").first();
    // The list loads after the page; wait for the first row before deciding the project is empty.
    await row.waitFor({ timeout: 15_000 }).catch(() => {});
    test.skip((await row.count()) === 0, "no mentions in the E2E project");
    const link = row.getByRole("link", { name: /Bài nhắc của/ });
    // Real link to the full page (cmd/middle-click opens a new tab).
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/mentions\/[0-9a-f-]{36}/);
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(/[?&]item=/);
    // Scan after the slide-in finishes: mid-animation opacity makes axe report false contrast failures.
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
    expect((await scan(page)).blocking).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(link).toBeFocused();
    await expect(page).not.toHaveURL(/[?&]item=/);
    // Back closes the slide-out and keeps the list (no full-page navigation).
    await link.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(row).toBeVisible();
    await expect(page.getByText("Quay lại danh sách")).toHaveCount(0);
    // Deep link renders the full page.
    await page.goto(href ?? "/mentions");
    await expect(page.getByText("Quay lại danh sách")).toBeVisible();
    expect(serverErrors).toEqual([]);
  });
});
