import { expect, type Page } from "@playwright/test";
import { getCredentials, type E2eRole } from "./env";

/** Signs in through the /login form using role/label selectors and waits to leave /login. */
export async function loginAs(page: Page, role: E2eRole): Promise<void> {
  const creds = getCredentials(role);
  if (!creds) throw new Error(`Missing E2E credentials for role "${role}"`);
  await page.goto("/login");
  // Vietnamese sign-in copy since #286 (labels carry a required "*", so match the start).
  await page.getByLabel(/^E-mail công việc/).fill(creds.email);
  await page.getByLabel(/^Mật khẩu/).fill(creds.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  // Sign-in lands on the signboard wall (/) since #265; any URL other than /login means signed in.
  await expect(page).not.toHaveURL(/\/login/);
}
