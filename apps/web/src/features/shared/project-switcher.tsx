"use client";

import { Select } from "@/components/base/select/select";
import { useCurrentProject } from "@/features/auth/use-current-project";

/** Rendered only with ≥ 2 memberships (UX §1, FR-036, TC-PROJ-012). */
export function ProjectSwitcher() {
  const { project, projects, setProjectId } = useCurrentProject();
  if (projects.length < 2) return null;
  return (
    <Select
      aria-label="Project"
      size="sm"
      items={projects.map((p) => ({ id: p.id, label: p.name }))}
      selectedKey={project?.id ?? null}
      onSelectionChange={(key) => {
        if (key !== null) setProjectId(String(key));
      }}
    >
      {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
    </Select>
  );
}
