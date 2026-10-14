import type { AppConfig } from "../../src/config/config.module";
import { loadEnv } from "../../src/config/env.schema";

/**
 * #266: dev `apps/api/.env` (copied into every worktree, auto-loaded by Prisma Client) may carry local Supabase
 * auth settings. Tests sign tokens with AUTH_TEST_JWT_SECRET, so these keys must never reach the test app.
 */
export const TEST_STRIPPED_AUTH_VARS = [
  "SUPABASE_URL",
  "SUPABASE_JWKS_URL",
  "SUPABASE_JWT_SECRET",
  "SUPABASE_JWT_ISSUER",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/** Removes dev Supabase auth vars from the given env (mutates). */
export function stripDevAuthEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const key of TEST_STRIPPED_AUTH_VARS) delete env[key];
}

/** Loads app config without dev Supabase auth vars — independent of the developer's `.env` (#266). */
export function loadTestEnv(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const filtered: NodeJS.ProcessEnv = { ...source };
  stripDevAuthEnv(filtered);
  return loadEnv(filtered);
}
