import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";
import { BrandLogo } from "@/features/shared/brand-logo";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Đăng nhập" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** UX §3.1 — FR-010, FR-012 (Google behind flag). Signboard style (#286): wall + one white enamel board. */
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--wall)] px-4 py-10">
      <div className="operate-board relative w-full max-w-sm">
        <span aria-hidden className="sign-keyline" />
        <div className="relative p-6 sm:p-8">
          <div className="mb-2 flex justify-center">
            <BrandLogo variant="stacked" className="h-28 w-auto" />
          </div>
          <p lang="vi" className="mb-4 text-center text-sm text-tertiary">
            Lắng nghe. Thấu hiểu.
          </p>
          <h1 className="page-fascia-title text-center">Đăng nhập</h1>
          <LoginForm
            googleEnabled={env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED}
            reason={first(sp.reason)}
            next={first(sp.next)}
          />
          <p className="mt-6 text-center text-xs text-tertiary">Chưa có tài khoản? Nhờ quản trị viên cấp quyền.</p>
        </div>
      </div>
    </main>
  );
}
