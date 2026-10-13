"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, type PropsWithChildren } from "react";
import { setAccessTokenGetter, setTokenExpiredHandler } from "@/lib/api/client";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { hardSignOut } from "./sign-out";

/** Wires the Supabase session into the API client (bearer + one refresh on AUTH_TOKEN_EXPIRED). */
export function AuthBridge({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let inflight: Promise<boolean> | null = null;

    setAccessTokenGetter(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);
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

  return <>{children}</>;
}
