import type { ReactNode } from "react";
import { PageHeader } from "./page-header";

export type PlaceholderTask = { id: string; label: string };

/**
 * Temporary page body used until the feature tasks land (#279). The "Sẽ làm trong" list is a white enamel board
 * with a navy keyline; each backlog task hangs on it as a small task plate (DESIGN.md, Operate Surfaces).
 */
export function PagePlaceholder({
  title,
  description,
  tasks,
  children,
}: {
  title: string;
  description: string;
  tasks: PlaceholderTask[];
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 lg:px-8">
      <PageHeader title={title} description={description} />
      <section aria-labelledby="placeholder-tasks-title" className="operate-board p-5">
        <span aria-hidden className="sign-keyline" />
        <div className="relative flex flex-col gap-3">
          <h2 id="placeholder-tasks-title" className="operate-board-title">
            Sẽ làm trong
          </h2>
          <ul className="flex flex-wrap gap-2">
            {tasks.map((t) => (
              <li key={t.id} className="task-plate">
                <span className="tabular-nums">{t.id}</span> · {t.label}
              </li>
            ))}
          </ul>
        </div>
      </section>
      {children}
    </div>
  );
}
