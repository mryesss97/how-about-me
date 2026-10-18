import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

/**
 * Shared page frame (#348): one width, gutter and 24 px rhythm for every working screen so the fascia,
 * tabs and boards line up across routes. Each page still renders its own `PageHeader`.
 */
export function PageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8", className)}>{children}</div>
  );
}
