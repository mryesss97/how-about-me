import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/features/auth/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** OAuth / magic-link callback (FR-012): exchange the code for a session cookie, then continue. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    } catch {
      // fall through to login
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}
