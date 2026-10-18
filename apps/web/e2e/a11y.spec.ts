import { expect, test } from "@playwright/test";
import { scan } from "./support/axe";

// #95 / NFR-032: public pages (no session needed) — axe serious/critical must be 0.
for (const path of ["/", "/login"]) {
  test(`axe: ${path} has no serious/critical violations`, async ({ page }, info) => {
    await page.goto(path);
    const { blocking, other } = await scan(page);
    await info.attach("axe-other", { body: other.join("\n") || "none", contentType: "text/plain" });
    expect(blocking).toEqual([]);
  });
}
