import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { scan } from "./support/axe";
import { hasSession } from "./support/env";

// #95 / NFR-031..033: axe gate on working screens + responsive smoke at 1280 and 900 (TC-DASH-024).
const PAGES = ["/overview", "/mentions", "/reviews", "/listening-queries", "/system-status"];

// #327: 390px never scrolls the page on any app route (docs/01-product/09-ux-specification.md).
const ROUTES_390 = [
  "/overview",
  "/mentions",
  "/reviews",
  "/listening-queries",
  "/system-status",
  "/terms",
  "/settings/project",
  "/settings/members",
  "/settings/integrations",
  "/settings/analysis",
];

async function expectNoOverflowAt390(page: Page, path: string): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const result = await page.evaluate(() => {
    const vw = window.innerWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => el.getBoundingClientRect().right > vw + 0.5)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 4).join(".")}`);
    return { overflow: document.documentElement.scrollWidth - vw, offenders };
  });
  expect(result.overflow, `page overflows at 390px; offenders: ${result.offenders.join(", ")}`).toBeLessThanOrEqual(0);
}

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

  for (const path of ROUTES_390) {
    test(`#327: ${path} @390 never scrolls the page`, async ({ page }) => {
      await expectNoOverflowAt390(page, path);
    });
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

test.describe("no page overflow @390 (viewer)", () => {
  test.beforeEach(() => {
    test.skip(!hasSession("viewer"), "no viewer session: needs E2E_VIEWER_*");
  });

  // Members is admin-only; a viewer would only see the redirect target, already covered.
  for (const path of ROUTES_390.filter((p) => p !== "/settings/members")) {
    test(`#327: ${path} @390 never scrolls the page (viewer)`, async ({ asRole }) => {
      const page = await asRole("viewer");
      await expectNoOverflowAt390(page, path);
    });
  }
});
