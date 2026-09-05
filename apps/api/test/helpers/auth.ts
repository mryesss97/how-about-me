import { SignJWT } from "jose";

/** Mints a Supabase-shaped HS256 access token for integration tests (verified via AUTH_TEST_JWT_SECRET). */
export async function mintTestJwt(opts: { sub: string; email: string; name?: string; expiresIn?: string }) {
  const secret = new TextEncoder().encode(process.env.AUTH_TEST_JWT_SECRET);
  return new SignJWT({ email: opts.email, user_metadata: { full_name: opts.name ?? null }, role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(opts.sub)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "1h")
    .sign(secret);
}
