import { SignJWT } from "jose";

/** Mints a Supabase-shaped HS256 access token for tests (verified via AUTH_TEST_JWT_SECRET unless `secret` given). */
export async function mintTestJwt(opts: {
  sub?: string;
  email: string;
  name?: string;
  expiresIn?: string | number;
  issuer?: string;
  audience?: string;
  secret?: string;
  extra?: Record<string, unknown>;
}) {
  const secret = new TextEncoder().encode(opts.secret ?? process.env.AUTH_TEST_JWT_SECRET);
  const jwt = new SignJWT({
    email: opts.email,
    user_metadata: { full_name: opts.name ?? null },
    role: "authenticated",
    ...opts.extra,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(opts.audience ?? "authenticated")
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "1h");
  if (opts.sub) jwt.setSubject(opts.sub);
  if (opts.issuer) jwt.setIssuer(opts.issuer);
  return jwt.sign(secret);
}
