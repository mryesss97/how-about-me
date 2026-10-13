// Pure helpers for the FE secret scan (docs/02-architecture/08-security-secrets.md §9).

/** Server-only env vars that must never reach the web build or bundle. */
export const SERVER_ONLY = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "THREADS_APP_SECRET",
  "THREADS_ACCESS_TOKEN",
  "INTEGRATION_ENCRYPTION_KEYS",
  "DATABASE_URL",
  "DIRECT_URL",
];

/** Name/value patterns forbidden inside the built bundle. */
export const FORBIDDEN_PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /service_role/i,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /OPENAI_API_KEY/,
  /THREADS_APP_SECRET/,
  /THREADS_ACCESS_TOKEN/,
  /INTEGRATION_ENCRYPTION_KEYS/,
  /DATABASE_URL/,
];

const SENSITIVE_PUBLIC_NAME = /SERVICE_ROLE|SECRET|OPENAI|TOKEN|PRIVATE|DATABASE/;
const OPENAI_KEY = /^sk-[A-Za-z0-9_-]{16,}/;
const MIN_VALUE_LEN = 8;

/** Returns the JWT payload role, or undefined when the value is not a decodable JWT. */
export function jwtRole(value) {
  const parts = value.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload?.role === "string" ? payload.role : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Scans the build environment. With `buildEnv`, any server-only var being set is a failure
 * (the web build must not see it). Always rejects sensitive-looking NEXT_PUBLIC_* vars.
 */
export function scanEnv(env, { buildEnv = false } = {}) {
  const problems = [];
  if (buildEnv) {
    for (const name of SERVER_ONLY) {
      if (env[name]) problems.push(`server-only env ${name} is set during web build`);
    }
  }
  for (const [name, raw] of Object.entries(env)) {
    if (!name.startsWith("NEXT_PUBLIC_") || !raw) continue;
    const value = String(raw);
    if (SENSITIVE_PUBLIC_NAME.test(name)) problems.push(`${name}: sensitive name exposed to browser`);
    if (OPENAI_KEY.test(value)) problems.push(`${name}: value looks like an OpenAI key`);
    if (jwtRole(value) === "service_role") problems.push(`${name}: value is a service_role JWT`);
  }
  return problems;
}

/** Scans one bundle file's text for forbidden patterns and literal server-only secret values. */
export function scanText(text, env = {}) {
  const hits = [];
  for (const re of FORBIDDEN_PATTERNS) if (re.test(text)) hits.push(String(re));
  for (const name of SERVER_ONLY) {
    const value = env[name];
    if (value && value.length >= MIN_VALUE_LEN && text.includes(value)) hits.push(`value of ${name}`);
  }
  return hits;
}
