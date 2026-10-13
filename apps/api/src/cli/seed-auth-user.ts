// Optional: ensure the SEED_ADMIN_EMAIL user exists in Supabase Auth (US-006, T-008).
// Server/CLI only. Never logs the service-role key or password.

export type SeedAuthEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SEED_ADMIN_EMAIL?: string;
  SEED_ADMIN_PASSWORD?: string;
};

export type SeedAuthResult = "skipped" | "exists" | "created" | "invited";

type FetchFn = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

function hasEmail(body: unknown, email: string): boolean {
  if (typeof body !== "object" || body === null || !("users" in body)) return false;
  const { users } = body as { users: unknown };
  if (!Array.isArray(users)) return false;
  return users.some(
    (u: unknown) =>
      typeof u === "object" &&
      u !== null &&
      "email" in u &&
      String((u as { email: unknown }).email).toLowerCase() === email,
  );
}

export async function seedAuthUser(
  env: SeedAuthEnv,
  deps: { fetch: FetchFn; log: (m: string) => void },
): Promise<SeedAuthResult> {
  const url = env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const email = env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!url || !key || !email) {
    deps.log("seed:auth-user skipped — SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_ADMIN_EMAIL are required.");
    return "skipped";
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  // Scan pages of the admin user list for the email.
  for (let page = 1; ; page++) {
    const res = await deps.fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=1000`, { method: "GET", headers });
    if (!res.ok) throw new Error(`Supabase list users failed (HTTP ${res.status})`);
    const body = await res.json();
    if (hasEmail(body, email)) {
      deps.log(`auth user exists: ${email}`);
      return "exists";
    }
    const users = (body as { users?: unknown }).users;
    if (!Array.isArray(users) || users.length < 1000) break;
  }

  if (env.SEED_ADMIN_PASSWORD) {
    const res = await deps.fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password: env.SEED_ADMIN_PASSWORD, email_confirm: true }),
    });
    if (!res.ok) throw new Error(`Supabase create user failed (HTTP ${res.status})`);
    deps.log(`auth user created: ${email}`);
    return "created";
  }
  const res = await deps.fetch(`${url}/auth/v1/invite`, { method: "POST", headers, body: JSON.stringify({ email }) });
  if (!res.ok) throw new Error(`Supabase invite failed (HTTP ${res.status})`);
  deps.log(`auth invite sent: ${email}`);
  return "invited";
}

if (require.main === module) {
  seedAuthUser(process.env, { fetch: (u, i) => fetch(u, i), log: (m) => console.log(m) }).catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : "seed:auth-user failed");
    process.exit(1);
  });
}
