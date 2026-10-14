"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { safeNext } from "./safe-next";

export const LOGIN_ERROR = "E-mail hoặc mật khẩu không đúng";
export const EXPIRED_NOTICE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
export const FORBIDDEN_NOTICE = "Tài khoản không có quyền truy cập. Liên hệ quản trị viên.";

interface LoginFormProps {
  googleEnabled: boolean;
  reason?: string;
  next?: string;
}

/** UX §3.1 / FR-010. No sign-up link (TC-AUTH-004); errors never reveal which field was wrong (TC-AUTH-002). */
export function LoginForm({ googleEnabled, reason, next }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { error: authError } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      if (authError) {
        setError(LOGIN_ERROR);
        return;
      }
      router.replace(safeNext(next));
      router.refresh();
    } catch {
      setError(LOGIN_ERROR);
    } finally {
      setPending(false);
    }
  }

  async function onGoogle() {
    const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(safeNext(next))}` : ""}`;
    await getSupabaseBrowserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  }

  return (
    <>
      {reason === "expired" && (
        <p role="status" className="mt-4 rounded-[2px] bg-utility-yellow-50 px-3 py-2 text-sm text-utility-yellow-700">
          {EXPIRED_NOTICE}
        </p>
      )}
      {/* Render-only: no flow sends ?reason=forbidden yet (#286). Text carries meaning, not colour (BR-017). */}
      {reason === "forbidden" && (
        <p role="status" className="mt-4 rounded-[2px] bg-utility-red-50 px-3 py-2 text-sm text-utility-red-700">
          {FORBIDDEN_NOTICE}
        </p>
      )}
      <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate={false}>
        <Input
          isRequired
          type="email"
          name="email"
          label="E-mail công việc"
          placeholder="ban@congty.com"
          autoComplete="email"
          value={email}
          onChange={setEmail}
        />
        <Input
          isRequired
          type="password"
          name="password"
          label="Mật khẩu"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        {error && (
          <p role="alert" className="text-sm text-error-primary">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" isLoading={pending} isDisabled={pending}>
          Tiếp tục
        </Button>
      </form>
      {googleEnabled && (
        <Button type="button" color="secondary" size="lg" className="mt-3 w-full" onClick={() => void onGoogle()}>
          Tiếp tục với Google
        </Button>
      )}
    </>
  );
}
