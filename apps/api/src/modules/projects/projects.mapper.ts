import type { Project, UserRole } from "@how-about-me/contracts";
import { ProjectSettingsSchema } from "@how-about-me/contracts";

export type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  settings: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Maps a monitoring_projects row to the `Project` DTO; settings get contract defaults for missing keys. */
export function toProject(p: ProjectRow, role?: UserRole): Project {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    timezone: p.timezone,
    settings: ProjectSettingsSchema.parse(p.settings ?? {}),
    isActive: p.isActive,
    role,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
