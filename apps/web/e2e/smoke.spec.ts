import { expect, test } from "@playwright/test";

// Full smoke flow (login → overview → filter → detail → role restriction) is implemented in T-015/T-032+. This keeps the pipeline wired.
test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});
