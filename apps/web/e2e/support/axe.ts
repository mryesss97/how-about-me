import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** WCAG 2.1 AA scan (NFR-032, #95). Only serious/critical fail; moderate/minor are returned for the report. */
export async function scan(page: Page) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const blocking = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const fmt = (vs: typeof res.violations) =>
    vs.map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  return { blocking: fmt(blocking), other: fmt(res.violations.filter((v) => !blocking.includes(v))) };
}
