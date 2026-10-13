"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type PropsWithChildren } from "react";
import { setAccessTokenGetter, setTokenExpiredHandler } from "@/lib/api/client";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { hardSignOut } from "./sign-out";
import { CurrentProjectProvider } from "./use-current-project";

const sessionTokenGetter = async () =>
  (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token ?? null;

/** Wires the Supabase session into the API client (bearer + one refresh on AUTH_TOKEN_EXPIRED). */
export function AuthBridge({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const router = useRouter();
  // Register the bearer getter during the first render: child effects (e.g. `useMe` in the sidebar) run
  // before this component's effects, so registering in useEffect sent the first `GET /me` without a token.
  useState(() => {
    if (typeof window !== "undefined") setAccessTokenGetter(sessionTokenGetter);
    return null;
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let inflight: Promise<boolean> | null = null;

    setAccessTokenGetter(sessionTokenGetter);
    // Concurrent 401s share one refresh promise.
    setTokenExpiredHandler(() => {
      inflight ??= (async () => {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error || !data.session) {
            await hardSignOut(queryClient, "expired");
            return false;
          }
          return true;
        } catch {
          await hardSignOut(queryClient, "expired");
          return false;
        } finally {
          inflight = null;
        }
      })();
      return inflight;
    });

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        router.replace("/login");
      }
    });

    return () => {
      data.subscription.unsubscribe();
      setTokenExpiredHandler(null);
      setAccessTokenGetter(() => null);
    };
  }, [queryClient, router]);

  return <CurrentProjectProvider>{children}</CurrentProjectProvider>;
}
