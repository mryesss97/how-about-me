import type { INestApplication } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import type { UserRole } from "@how-about-me/contracts";
import {
  PROJECT_SETTING_GATE_KEY,
  type ProjectSettingGate,
} from "../../src/common/auth/project-setting-gate.decorator";
import { ROLES_KEY } from "../../src/common/auth/roles.decorator";

export type DiscoveredRoute = { method: string; path: string; roles: UserRole[]; gates: ProjectSettingGate[] };

const norm = (...parts: (string | undefined)[]) =>
  parts
    .flatMap((p) => (p ?? "").split("/"))
    .filter(Boolean)
    .join("/");

const first = (v: unknown): string | undefined => (Array.isArray(v) ? (v[0] as string | undefined) : (v as string));

/** Lists every HTTP handler of the app with its `@Roles` / `@AllowRoleWhenSetting` metadata (path without global prefix). */
export function discoverRoutes(app: INestApplication): DiscoveredRoute[] {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);
  const reflector = app.get(Reflector);
  const routes: DiscoveredRoute[] = [];
  for (const wrapper of discovery.getControllers()) {
    const instance = wrapper.instance as Record<string, unknown> | undefined;
    const cls = wrapper.metatype;
    if (!instance || !cls) continue;
    const base = first(Reflect.getMetadata(PATH_METADATA, cls));
    for (const name of scanner.getAllMethodNames(Object.getPrototypeOf(instance) as object)) {
      const handler = instance[name];
      if (typeof handler !== "function") continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (method === undefined) continue;
      const targets = [handler, cls];
      routes.push({
        method: RequestMethod[method],
        path: norm(base, first(Reflect.getMetadata(PATH_METADATA, handler))),
        roles: reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, targets) ?? [],
        gates: reflector.getAllAndOverride<ProjectSettingGate[] | undefined>(PROJECT_SETTING_GATE_KEY, targets) ?? [],
      });
    }
  }
  return routes;
}
