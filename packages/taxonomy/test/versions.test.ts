import { describe, expect, it } from "vitest";
import * as taxonomy from "../src/index.js";

// BR-023: version strings persisted on every analysis run.
describe("versions (BR-023)", () => {
  it("exports v1 version strings from index", () => {
    expect(taxonomy.TAXONOMY_VERSION).toBe("taxonomy-v1");
    expect(taxonomy.SAFETY_POLICY_VERSION).toBe("safety-policy-v1");
    expect(taxonomy.DEFAULT_PROMPT_VERSION).toBe("classifier-v1");
    expect(taxonomy.METRICS_VERSION).toBe("metrics-v1");
  });
});
