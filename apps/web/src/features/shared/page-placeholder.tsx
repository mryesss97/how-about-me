import type { ReactNode } from "react";

/** Temporary page body used until the feature tasks land. Lists the backlog tasks that replace it. */
export function PagePlaceholder({
  title,
  description,
  tasks,
  children,
}: {
  title: string;
  description: string;
  tasks: string[];
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-xs font-semibold text-primary">{title}</h1>
        <p className="text-md text-tertiary">{description}</p>
      </header>
      <section className="rounded-xl border border-secondary bg-primary p-5">
        <h2 className="text-sm font-semibold text-secondary">Implemented by</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {tasks.map((t) => (
            <li key={t} className="rounded-md bg-secondary px-2 py-1 font-mono text-xs text-secondary">
              {t}
            </li>
          ))}
        </ul>
      </section>
      {children}
    </div>
  );
}
