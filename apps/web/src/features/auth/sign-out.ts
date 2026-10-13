import type { QueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * FR-011 / TC-AUTH-016: sign out, drop every cached query, then hard-navigate with `location.replace`
 * so no history entry with data remains for the Back button.
 */
export async function hardSignOut(queryClient: QueryClient, reason?: "expired"): Promise<void> {
  try {
    await getSupabaseBrowserClient().auth.signOut();
  } catch {
    // Continue: local session is cleared regardless; the server guard rejects stale cookies.
  }
  queryClient.clear();
  window.location.replace(reason ? `/login?reason=${reason}` : "/login");
}
