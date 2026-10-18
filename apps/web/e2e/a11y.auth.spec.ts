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

  // #386: every interactive control in main is ≥ 44 px tall at 390 (inline prose links excluded).
  for (const path of ["/overview", "/mentions", "/settings/project", "/system-status"]) {
    test(`#386: ${path} @390 touch targets ≥ 44 px`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("main button, main a, main [role=tab]")]
          .filter((el) => !el.closest("p, td, [data-prose]"))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.height > 0 && r.height < 43.5)
          .slice(0, 5)
          .map(
            ({ el, r }) =>
              `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30)}" ${Math.round(r.height)}px`,
          ),
      );
      expect(small, `targets under 44 px: ${small.join(", ")}`).toEqual([]);
    });
  }

  test("#386: KPI ⓘ opens on tap @390 (FR-140)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/overview");
    await page
      .getByRole("button", { name: /^Giải thích / })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toContainText("Mẫu số:");
  });

  test("#386: settings toggle track keeps 36 px @390 (BR-017)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings/project");
    await page.waitForLoadState("networkidle");
    const widths = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main .rounded-full.cursor-pointer.shrink-0")].map(
        (el) => el.getBoundingClientRect().width,
      ),
    );
    for (const w of widths) expect(w).toBeGreaterThanOrEqual(35.5);
  });

  test("#386: Settings and System Status tabs share height @1366 (N4)", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const tabHeight = async (path: string, nav: string) => {
      await page.goto(path);
      const box = await page.getByRole("navigation", { name: nav }).getByRole("link").first().boundingBox();
      return box?.height ?? 0;
    };
    const settings = await tabHeight("/settings/project", "Các mục cài đặt");
    const status = await tabHeight("/system-status", "Các mục trạng thái");
    expect(settings).toBeGreaterThanOrEqual(43.5);
    expect(settings).toBe(status);
  });

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
