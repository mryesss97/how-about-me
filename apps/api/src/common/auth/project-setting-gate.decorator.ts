import type { UserRole } from "@how-about-me/contracts";
import type { ProjectToggleSetting } from "./project-settings";

export const PROJECT_SETTING_GATE_KEY = "projectSettingGate";
export type ProjectSettingGate = { role: UserRole; setting: ProjectToggleSetting };

/**
 * FR-015, docs/01-product/02-personas-rbac.md §3 (⚙️ cells): `role` (also listed in `@Roles`) is allowed only while
 * `monitoring_projects.settings[setting] === true` (defaults from `ProjectSettingsSchema`). Denied → 403 FORBIDDEN_ROLE.
 * Stacking several on one handler (or class) accumulates gates instead of the last one winning.
 */
export const AllowRoleWhenSetting =
  (role: UserRole, setting: ProjectToggleSetting): MethodDecorator & ClassDecorator =>
  (target: object, _key?: string | symbol, descriptor?: PropertyDescriptor) => {
    const holder: object = descriptor ? (descriptor.value as object) : target;
    const existing = (Reflect.getMetadata(PROJECT_SETTING_GATE_KEY, holder) as ProjectSettingGate[] | undefined) ?? [];
    Reflect.defineMetadata(PROJECT_SETTING_GATE_KEY, [...existing, { role, setting }], holder);
  };
