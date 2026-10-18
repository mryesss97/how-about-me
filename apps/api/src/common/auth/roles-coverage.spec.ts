import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { ROLES_KEY } from "./roles.decorator";

/**
 * FR-015 / T-121 checklist #4: every mutating route declares `@Roles(...)` (server-side authorization).
 * Scans all `*.controller.ts` under src so new controllers are covered automatically.
 */
const MUTATING = new Set<number>([RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE]);

/** Mutations that intentionally need only an authenticated user, not a project role. Keep this list short. */
const ALLOWED_WITHOUT_ROLES = new Set<string>([]);

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return name.endsWith(".controller.ts") ? [full] : [];
  });
}

function collectMutations(): { id: string; hasRoles: boolean; isPublic: boolean }[] {
  const out: { id: string; hasRoles: boolean; isPublic: boolean }[] = [];
  for (const file of controllerFiles(join(__dirname, "..", ".."))) {
    const mod = jest.requireActual<Record<string, unknown>>(file);
    for (const exported of Object.values(mod)) {
      if (typeof exported !== "function" || Reflect.getMetadata(PATH_METADATA, exported) === undefined) continue;
      const proto = (exported as { prototype: Record<string, unknown> }).prototype;
      for (const key of Object.getOwnPropertyNames(proto)) {
        const handler = proto[key];
        if (key === "constructor" || typeof handler !== "function") continue;
        const method: unknown = Reflect.getMetadata(METHOD_METADATA, handler);
        if (typeof method !== "number" || !MUTATING.has(method)) continue;
        const roles: unknown = Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, exported);
        const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
        out.push({ id: `${exported.name}.${key}`, hasRoles: Array.isArray(roles) && roles.length > 0, isPublic });
      }
    }
  }
  return out;
}

describe("@Roles coverage (FR-015, T-121)", () => {
  const mutations = collectMutations();

  it("finds the mutating routes", () => {
    expect(mutations.length).toBeGreaterThan(10);
  });

  it("every POST/PUT/PATCH/DELETE route declares @Roles (or is explicitly allowed)", () => {
    const missing = mutations.filter((m) => !m.hasRoles && !m.isPublic && !ALLOWED_WITHOUT_ROLES.has(m.id));
    expect(missing.map((m) => m.id)).toEqual([]);
  });

  it("no mutating route is @Public", () => {
    expect(mutations.filter((m) => m.isPublic).map((m) => m.id)).toEqual([]);
  });
});
