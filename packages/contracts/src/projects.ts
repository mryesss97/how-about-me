import { z } from "zod";
import { IanaTimezoneSchema, IsoDateTimeSchema, UuidSchema } from "./common.js";
import { UserRoleSchema } from "./enums.js";

export const ProjectSettingsSchema = z.object({
  allowAnalystReanalyze: z.boolean().default(true),
  allowViewerExport: z.boolean().default(false),
});
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
/** PATCH shape: optional booleans, no defaults (a partial patch must not reset unsent settings). */
export const ProjectSettingsPatchSchema = z.object({
  allowAnalystReanalyze: z.boolean().optional(),
  allowViewerExport: z.boolean().optional(),
});

export const ProjectSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  timezone: IanaTimezoneSchema,
  settings: ProjectSettingsSchema,
  isActive: z.boolean(),
  role: UserRoleSchema.optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Project = z.infer<typeof ProjectSchema>;

export const UpdateProjectBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    timezone: IanaTimezoneSchema.optional(),
    settings: ProjectSettingsPatchSchema.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "Empty update" });
export type UpdateProjectBody = z.infer<typeof UpdateProjectBodySchema>;

export const MeResponseSchema = z.object({
  id: UuidSchema,
  email: z.email(),
  displayName: z.string().nullable(),
  projects: z.array(
    ProjectSchema.pick({ id: true, name: true, slug: true, timezone: true, settings: true }).extend({
      role: UserRoleSchema,
    }),
  ),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const MemberSchema = z.object({
  userId: UuidSchema,
  email: z.email(),
  displayName: z.string().nullable(),
  role: UserRoleSchema,
  createdAt: IsoDateTimeSchema,
});
export type Member = z.infer<typeof MemberSchema>;
export const AddMemberBodySchema = z.object({ email: z.email(), role: UserRoleSchema });
export const UpdateMemberBodySchema = z.object({ role: UserRoleSchema });
