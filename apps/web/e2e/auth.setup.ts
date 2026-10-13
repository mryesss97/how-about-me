import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { test as setup } from "@playwright/test";
import { hasCredentials, storageStatePath, type E2eRole } from "./support/env";
import { loginAs } from "./support/login";

const ROLES: E2eRole[] = ["admin", "viewer"];

function writeEmptyState(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ cookies: [], origins: [] }));
}

for (const role of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const path = storageStatePath(role);
    // Always leave a valid file so dependent projects can load storageState.
    writeEmptyState(path);
    setup.skip(!hasCredentials(role), `needs E2E_${role.toUpperCase()}_EMAIL/PASSWORD`);
    await page.goto("/login");
    const loginWired = await page.getByRole("button", { name: "Continue" }).isEnabled();
    setup.skip(!loginWired, "login form not wired yet (T-032)");
    await loginAs(page, role);
    await page.context().storageState({ path });
  });
}
