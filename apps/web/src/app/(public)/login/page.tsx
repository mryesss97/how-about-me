import type { Metadata } from "next";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";

export const metadata: Metadata = { title: "Sign in" };

/** UX §3.1. Supabase wiring, error states and Google button land in T-032. */
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-sm rounded-2xl border border-secondary bg-primary p-8 shadow-xs">
        <h1 className="text-display-xs font-semibold text-primary">Sign in</h1>
        <p className="mt-1 text-sm text-tertiary">How About Me — Threads social listening</p>
        <form className="mt-6 flex flex-col gap-4" action="#">
          <Input
            isRequired
            type="email"
            name="email"
            label="Work email"
            placeholder="you@company.com"
            autoComplete="email"
          />
          <Input
            isRequired
            type="password"
            name="password"
            label="Password"
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <Button type="submit" size="lg" isDisabled>
            Continue
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-tertiary">No account? Ask an admin for access.</p>
      </div>
    </main>
  );
}
