import type { Page } from "@playwright/test";

/**
 * Waits until the page can take input: network quiet and the document complete. On a dev server that is still
 * compiling, a click right after `goto` lands before hydration and is lost (#359).
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForFunction(() => document.readyState === "complete");
}
