import { type ProjectSettings, ProjectSettingsSchema } from "@how-about-me/contracts";

/** Boolean project settings — the only keys a `@AllowRoleWhenSetting` gate may reference (numbers like `phraseMinMentions` are not permissions). */
export type ProjectToggleSetting = {
  [K in keyof ProjectSettings]: ProjectSettings[K] extends boolean ? K : never;
}[keyof ProjectSettings];

/**
 * FR-032 — malformed settings never cause a 500: each key that is missing, has the wrong type or is out of range falls
 * back to its own schema default (deny-safe for allowViewerExport, 2 for phraseMinMentions, `[]` for landingTerms); valid keys are kept, so
 * one bad key does not reset the others.
 */
export function parseProjectSettings(raw: unknown): ProjectSettings {
  const parsed = ProjectSettingsSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  const obj = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const shape = ProjectSettingsSchema.shape;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(shape) as (keyof ProjectSettings)[]) {
    const field = shape[key].safeParse(obj[key]);
    result[key] = field.success ? field.data : shape[key].parse(undefined);
  }
  return ProjectSettingsSchema.parse(result);
}
