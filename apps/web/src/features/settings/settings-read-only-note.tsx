"use client";

import { useCurrentProject } from "@/features/auth/use-current-project";

/** One admin-only note per Settings page, under the tabs (#347); forms no longer repeat it. UX only — FR-015. */
export function SettingsReadOnlyNote() {
  const { project } = useCurrentProject();
  if (!project || project.role === "admin") return null;
  return <p className="text-sm text-tertiary">Chỉ quản trị viên dự án mới thay đổi được các cài đặt này.</p>;
}
