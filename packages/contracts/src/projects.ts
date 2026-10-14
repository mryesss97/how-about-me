import { normalizePhrase, PHRASE_MAX_LENGTH } from "@how-about-me/taxonomy";
import { z } from "zod";
import { IanaTimezoneSchema, IsoDateTimeSchema, UuidSchema } from "./common.js";
import { UserRoleSchema } from "./enums.js";
import { DEFAULT_PHRASE_MIN_MENTIONS } from "./filters.js";

/** FR-032, FR-148 (#251): per-project bubble-map phrase threshold — integer 1–50, default 2. */
export const PHRASE_MIN_MENTIONS_SETTING_MIN = 1;
export const PHRASE_MIN_MENTIONS_SETTING_MAX = 50;
export const PhraseMinMentionsSettingSchema = z
  .number()
  .int()
  .min(PHRASE_MIN_MENTIONS_SETTING_MIN)
  .max(PHRASE_MIN_MENTIONS_SETTING_MAX);

/** FR-032, FR-149, BR-042 (#261): landing-page balloon phrases — ≤ 20 per project, each 1–60 chars, normalised like key phrases (BR-041). */
export const LANDING_TERMS_MAX = 20;
export const LANDING_TERM_MAX_LENGTH = PHRASE_MAX_LENGTH;
export const LandingTermSchema = z
  .string()
  .trim()
  .min(1)
  .max(LANDING_TERM_MAX_LENGTH)
  .transform((v) => normalizePhrase(v))
  .pipe(z.string({ error: "Enter 1–60 characters with a letter or digit" }));
/** BR-042: de-duplicated after normalisation, first occurrence order kept. Max applies to the submitted list. */
export const LandingTermsSettingSchema = z
  .array(LandingTermSchema)
  .max(LANDING_TERMS_MAX)
  .transform((terms) => [...new Set(terms)]);

export const ProjectSettingsSchema = z.object({
  allowAnalystReanalyze: z.boolean().default(true),
  allowViewerExport: z.boolean().default(false),
  phraseMinMentions: PhraseMinMentionsSettingSchema.default(DEFAULT_PHRASE_MIN_MENTIONS),
  landingTerms: LandingTermsSettingSchema.default([]),
});
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
/** PATCH shape: optional keys, no defaults (a partial patch must not reset unsent settings). */
export const ProjectSettingsPatchSchema = z.object({
  allowAnalystReanalyze: z.boolean().optional(),
  allowViewerExport: z.boolean().optional(),
  phraseMinMentions: PhraseMinMentionsSettingSchema.optional(),
  landingTerms: LandingTermsSettingSchema.optional(),
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
export const ProjectListResponseSchema = z.array(ProjectSchema);

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
export type AddMemberBody = z.infer<typeof AddMemberBodySchema>;
export const UpdateMemberBodySchema = z.object({ role: UserRoleSchema });
export type UpdateMemberBody = z.infer<typeof UpdateMemberBodySchema>;
export const MemberListResponseSchema = z.array(MemberSchema);
