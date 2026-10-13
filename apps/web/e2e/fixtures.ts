import { test as base, type Page } from "@playwright/test";
import { storageStatePath, type E2eRole } from "./support/env";

/** `asRole(role)` opens a new page with that role's saved session (e.g. viewer for FR-015 checks). */
export const test = base.extend<{ asRole: (role: E2eRole) => Promise<Page> }>({
  asRole: async ({ browser }, provide) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await provide(async (role) => {
      const context = await browser.newContext({ storageState: storageStatePath(role) });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

export { expect } from "@playwright/test";
