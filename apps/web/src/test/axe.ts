import axe from "axe-core";

/**
 * Runs axe-core on a rendered container (NFR-031/032). Returns serious/critical violations only —
 * moderate/minor are reported by the E2E spec but do not fail (#95).
 * `color-contrast` is disabled: jsdom has no layout/computed colours; contrast is gated in e2e/a11y.auth.spec.ts.
 */
export async function seriousViolations(container: Element): Promise<string[]> {
  const res = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return res.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}
