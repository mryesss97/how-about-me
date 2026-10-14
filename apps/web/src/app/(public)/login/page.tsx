import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";
import { BrandLogo } from "@/features/shared/brand-logo";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** UX §3.1 — FR-010, FR-012 (Google behind flag). */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-sm rounded-2xl border border-secondary bg-primary p-8 shadow-xs">
        <div className="mb-2 flex justify-center">
          <BrandLogo variant="stacked" className="h-28 w-auto" />
        </div>
        <p lang="vi" className="mb-6 text-center text-sm text-tertiary">
          Lắng nghe. Thấu hiểu.
        </p>
        <h1 className="text-display-xs font-semibold text-primary">Sign in</h1>
        <p className="mt-1 text-sm text-tertiary">How About Me — Threads social listening</p>
        <LoginForm
          googleEnabled={env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED}
          reason={first(sp.reason)}
          next={first(sp.next)}
        />
        <p className="mt-6 text-center text-xs text-tertiary">No account? Ask an admin for access.</p>
      </div>
    </main>
  );
}
