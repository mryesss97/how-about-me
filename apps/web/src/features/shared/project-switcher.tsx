"use client";

import { ChevronDown } from "@untitledui/icons";
import { usePathname, useRouter } from "next/navigation";
import {
  Button as AriaButton,
  Label as AriaLabel,
  ListBox as AriaListBox,
  Select as AriaSelect,
  SelectValue as AriaSelectValue,
} from "react-aria-components";
import { Popover } from "@/components/base/select/popover";
import { SelectItem } from "@/components/base/select/select-item";
import { SelectContext } from "@/components/base/select/select-shared";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useHydrated } from "@/hooks/use-hydrated";

/** Detail routes belong to one project; after a switch they go to their parent list (#348). */
const DETAIL_PARENT: { prefix: string; parent: string }[] = [
  { prefix: "/mentions/", parent: "/mentions" },
  { prefix: "/terms/", parent: "/overview" },
];

/** #348: keep the route, drop project-scoped filters (query ids, terms); detail routes go to their parent. */
export function routeAfterProjectSwitch(pathname: string): string {
  return DETAIL_PARENT.find((d) => pathname.startsWith(d.prefix))?.parent ?? pathname;
}

/**
 * Current project in the shell, right under the logo (#348, UX §1). Every role sees the name; with ≥ 2
 * memberships it becomes a labelled select (FR-036, TC-PROJ-012). Waits for hydration (#361).
 */
export function ShellProject() {
  const hydrated = useHydrated();
  const { project, projects, setProjectId } = useCurrentProject();
  const router = useRouter();
  const pathname = usePathname() ?? "/overview";
  if (!hydrated || !project) return null;

  if (projects.length < 2)
    return (
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="shell-project-label">Dự án</p>
        <p className="shell-project-name" title={project.name}>
          {project.name}
        </p>
      </div>
    );

  return (
    <SelectContext.Provider value={{ size: "sm" }}>
      <AriaSelect
        className="flex min-w-0 flex-col gap-1"
        selectedKey={project.id}
        onSelectionChange={(key) => {
          if (key === null || String(key) === project.id) return;
          setProjectId(String(key));
          router.replace(routeAfterProjectSwitch(pathname));
        }}
      >
        <AriaLabel className="shell-project-label">Dự án</AriaLabel>
        <AriaButton className="shell-project-trigger">
          <AriaSelectValue className="min-w-0 truncate" />
          <ChevronDown aria-hidden className="size-4 shrink-0" />
        </AriaButton>
        <Popover size="sm">
          <AriaListBox items={projects.map((p) => ({ id: p.id, label: p.name }))} className="size-full outline-hidden">
            {(item) => (
              <SelectItem id={item.id} label={item.label}>
                {item.label}
              </SelectItem>
            )}
          </AriaListBox>
        </Popover>
      </AriaSelect>
    </SelectContext.Provider>
  );
}
