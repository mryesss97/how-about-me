import type { ReactNode } from "react";
import { HealthStrip } from "./health-strip";

/**
 * Page fascia (#274): every working screen opens under a white enamel board with a navy keyline and its title
 * painted in sign lettering (DESIGN.md, Operate surfaces). The description stays Inter for reading.
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** #336: small Inter status line (e.g. "Đồng bộ lần cuối …") on the right; drops below the title under sm. */
  meta?: ReactNode;
}) {
  // #345: the collection-health strip sits right under the fascia on every working screen.
  return (
    <div className="flex flex-col gap-3">
      <header className="page-fascia">
        <span aria-hidden className="sign-keyline" />
        <div className="relative flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="page-fascia-title">{title}</h1>
            {description ? <p className="text-sm text-secondary">{description}</p> : null}
          </div>
          {meta ? <div className="basis-full sm:basis-auto">{meta}</div> : null}
          {actions}
        </div>
      </header>
      <HealthStrip />
    </div>
  );
}
