import type { AnalysisSettings, Member, Project } from "@how-about-me/contracts";
import { SAFETY_CATEGORIES } from "@how-about-me/taxonomy";
import { P1 } from "@/features/auth/test-utils";

export const projectData = (over: Partial<Project> = {}): Project => ({
  id: P1,
  name: "Brand A",
  slug: "brand-a",
  description: null,
  timezone: "Asia/Ho_Chi_Minh",
  settings: { allowAnalystReanalyze: true, allowViewerExport: false, phraseMinMentions: 2 },
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

export const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const VIEWER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const memberData = (userId: string, role: Member["role"], email: string): Member => ({
  userId,
  email,
  displayName: null,
  role,
  createdAt: "2026-01-01T00:00:00.000Z",
});

export const analysisSettingsData = (over: Partial<AnalysisSettings> = {}): AnalysisSettings => ({
  policyVersion: "safety-policy-v1",
  version: 1,
  isDefault: true,
  confidenceBands: { high: 0.8, medium: 0.5 },
  safetyThresholds: Object.fromEntries(
    SAFETY_CATEGORIES.map((c) => [c, { sensitive: 0.5, severe: 0.8 }]),
  ) as AnalysisSettings["safetyThresholds"],
  versions: {
    classifierProvider: "openai",
    classifierModel: "gpt-x",
    promptVersion: "p1",
    taxonomyVersion: "t1",
    safetyProvider: "openai",
    safetyModel: "omni-moderation",
    safetyPolicyVersion: "safety-policy-v1",
  },
  effectiveVersion: "openai:gpt-x:p1:t1:safety-policy-v1",
  outdatedCount: 0,
  createdAt: null,
  createdBy: null,
  ...over,
});
