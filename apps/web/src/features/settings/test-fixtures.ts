import type { Member, Project } from "@how-about-me/contracts";
import { P1 } from "@/features/auth/test-utils";

export const projectData = (over: Partial<Project> = {}): Project => ({
  id: P1,
  name: "Brand A",
  slug: "brand-a",
  description: null,
  timezone: "Asia/Ho_Chi_Minh",
  settings: { allowAnalystReanalyze: true, allowViewerExport: false },
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
