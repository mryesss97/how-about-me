import type { ReactNode } from "react";

/** `detail` is the parallel slot for the intercepted slide-out (`@detail/(.)[id]`, T-104). */
export default function MentionsLayout({ children, detail }: { children: ReactNode; detail: ReactNode }) {
  return (
    <>
      {children}
      {detail}
    </>
  );
}
