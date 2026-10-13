import { expect, type Page } from "@playwright/test";
import { getCredentials, type E2eRole } from "./env";

/** Signs in through the /login form using role/label selectors and waits for /overview. */
export async function loginAs(page: Page, role: E2eRole): Promise<void> {
  const creds = getCredentials(role);
  if (!creds) throw new Error(`Missing E2E credentials for role "${role}"`);
  await page.goto("/login");
  await page.getByLabel("Work email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/overview/);
}
