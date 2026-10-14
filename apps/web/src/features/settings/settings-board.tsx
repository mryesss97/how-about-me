import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

interface SettingsBoardProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Operate board for one settings section (#281): navy keyline + condensed caps title; controls stay Inter. */
export function SettingsBoard({ title, description, action, className, children }: SettingsBoardProps) {
  return (
    <section className={cx("operate-board flex flex-col gap-4 p-5", className)}>
      <span aria-hidden className="sign-keyline" />
      <header className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="operate-board-title">{title}</h2>
          {description ? <p className="mt-1 text-sm text-tertiary">{description}</p> : null}
        </div>
        {action}
      </header>
      <div className="relative min-w-0">{children}</div>
    </section>
  );
}
