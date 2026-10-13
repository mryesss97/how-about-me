import { describe, expect, it } from "vitest";
import { canAccess } from "./route-roles";

// FR-018 / BR-033: UI mirrors server permissions.
describe("canAccess", () => {
  it.each([
    ["/overview", "viewer", true],
    ["/listening-queries", "viewer", true],
    ["/settings/project", "viewer", true],
    ["/settings/integrations", "viewer", false], // TC-AUTH-014/015
    ["/settings/integrations", "analyst", true],
    ["/settings/integrations/x", "viewer", false],
    ["/settings/members", "analyst", false],
    ["/settings/members", "admin", true],
    ["/settings/integrationsfoo", "viewer", true],
  ] as const)("%s as %s → %s", (path, role, ok) => {
    expect(canAccess(path, role)).toBe(ok);
  });

  it("role not loaded sees only open routes", () => {
    expect(canAccess("/overview", null)).toBe(true);
    expect(canAccess("/settings/members", null)).toBe(false);
  });
});
