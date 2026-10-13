import {
  ConfidenceBandsSchema,
  PolicyProbabilitySchema,
  SafetyThresholdSchema,
  type AnalysisSettings,
  type UpdateAnalysisSettingsBody,
} from "@how-about-me/contracts";
import { SAFETY_CATEGORIES, type SafetyCategory } from "@how-about-me/taxonomy";

/** Form values are kept as strings so the user can type partial numbers; an empty threshold cell means `null`. */
export type ThresholdDraft = { sensitive: string; severe: string };
export type AnalysisDraft = {
  bands: { high: string; medium: string };
  thresholds: Record<SafetyCategory, ThresholdDraft>;
};
/** Keys use the server issue path format (`confidenceBands.medium`, `safetyThresholds.hate.sensitive`); `form` = unmatched. */
export type PolicyErrors = Record<string, string>;
type Patch = Partial<UpdateAnalysisSettingsBody>;

const str = (v: number | null) => (v === null ? "" : String(v));

export function toDraft(s: AnalysisSettings): AnalysisDraft {
  const thresholds = Object.fromEntries(
    SAFETY_CATEGORIES.map((c) => [
      c,
      { sensitive: str(s.safetyThresholds[c].sensitive), severe: str(s.safetyThresholds[c].severe) },
    ]),
  ) as Record<SafetyCategory, ThresholdDraft>;
  return { bands: { high: str(s.confidenceBands.high), medium: str(s.confidenceBands.medium) }, thresholds };
}

/** Empty → `null`; non-numeric or finer than 0.01 → "invalid". Rounds away float noise (0.1 + 0.2). */
export function parseProbability(input: string): number | null | "invalid" {
  const t = input.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return "invalid";
  const cents = Math.round(n * 100);
  if (Math.abs(n * 100 - cents) > 1e-6) return "invalid";
  return cents / 100;
}

const INVALID = "Enter a number between 0.01 and 1 in steps of 0.01";

function field(path: string, input: string, errors: PolicyErrors, required: boolean): number | null | undefined {
  const v = parseProbability(input);
  if (v === "invalid") {
    errors[path] = INVALID;
    return undefined;
  }
  if (v === null) {
    if (required) errors[path] = "Required";
    return required ? undefined : null;
  }
  if (!PolicyProbabilitySchema.safeParse(v).success) {
    errors[path] = INVALID;
    return undefined;
  }
  return v;
}

function addIssues(
  prefix: string,
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
  errors: PolicyErrors,
) {
  for (const i of issues) {
    const key = [prefix, ...i.path.map(String)].join(".");
    errors[key] ??= i.message;
  }
}

/** Client-side check of every cell; cross-field rules re-run for the whole pair (BR-018, BR-021). */
export function validateDraft(draft: AnalysisDraft): PolicyErrors {
  const errors: PolicyErrors = {};
  const high = field("confidenceBands.high", draft.bands.high, errors, true);
  const medium = field("confidenceBands.medium", draft.bands.medium, errors, true);
  if (typeof high === "number" && typeof medium === "number") {
    const r = ConfidenceBandsSchema.safeParse({ high, medium });
    if (!r.success) addIssues("confidenceBands", r.error.issues, errors);
  }
  for (const c of SAFETY_CATEGORIES) {
    const p = `safetyThresholds.${c}`;
    const sensitive = field(`${p}.sensitive`, draft.thresholds[c].sensitive, errors, false);
    const severe = field(`${p}.severe`, draft.thresholds[c].severe, errors, false);
    if (sensitive === undefined || severe === undefined) continue;
    const r = SafetyThresholdSchema.safeParse({ sensitive, severe });
    if (!r.success) addIssues(p, r.error.issues, errors);
  }
  return errors;
}

const valueOf = (s: string) => {
  const v = parseProbability(s);
  return v === "invalid" ? undefined : v;
};

/** FR-190: PATCH body with only the changed parts. Bands go as a full pair; thresholds per changed category. */
export function diffAnalysisSettings(current: AnalysisSettings, draft: AnalysisDraft): Patch {
  const body: Patch = {};
  const high = valueOf(draft.bands.high);
  const medium = valueOf(draft.bands.medium);
  if (high !== current.confidenceBands.high || medium !== current.confidenceBands.medium) {
    if (typeof high === "number" && typeof medium === "number") body.confidenceBands = { high, medium };
  }
  const thresholds: NonNullable<Patch["safetyThresholds"]> = {};
  for (const c of SAFETY_CATEGORIES) {
    const sensitive = valueOf(draft.thresholds[c].sensitive);
    const severe = valueOf(draft.thresholds[c].severe);
    if (sensitive === undefined || severe === undefined) continue;
    const cur = current.safetyThresholds[c];
    if (sensitive !== cur.sensitive || severe !== cur.severe) thresholds[c] = { sensitive, severe };
  }
  if (Object.keys(thresholds).length > 0) body.safetyThresholds = thresholds;
  return body;
}

/** Map server `VALIDATION_ERROR` issues onto known cells; anything else goes to `form`. */
export function errorsFromIssues(issues: { path: string; message: string }[], draft: AnalysisDraft): PolicyErrors {
  const known = new Set(["confidenceBands.high", "confidenceBands.medium"]);
  for (const c of Object.keys(draft.thresholds)) {
    known.add(`safetyThresholds.${c}`);
    known.add(`safetyThresholds.${c}.sensitive`);
    known.add(`safetyThresholds.${c}.severe`);
  }
  const out: PolicyErrors = {};
  for (const i of issues) {
    const key = known.has(i.path) ? i.path : i.path === "confidenceBands" ? "confidenceBands.medium" : "form";
    out[key] ??= i.message;
  }
  return out;
}
