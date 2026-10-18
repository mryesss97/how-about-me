import type { ReactNode } from "react";

/** Operate board + definition rows used by the overview cards (UX §3.6). */
export function Board({
  title,
  plate,
  action,
  children,
}: {
  title: string;
  plate?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="operate-board min-w-0">
      <span aria-hidden className="sign-keyline" />
      <div className="relative flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="operate-board-title">{title}</h2>
          {plate}
          {action ? <div className="ml-auto">{action}</div> : null}
        </div>
        <dl className="flex flex-col gap-2">{children}</dl>
      </div>
    </section>
  );
}

export function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-semibold text-tertiary">{label}</dt>
      <dd className="kpi-figure">{value}</dd>
    </div>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-tertiary">{label}</dt>
      <dd className="text-right break-words text-primary">{value}</dd>
    </div>
  );
}
