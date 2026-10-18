/**
 * Target guard for `pnpm db:seed:demo` (#294). The demo seed rewrites demo rows, so it only runs against a local
 * Postgres (any database name — the dev DB is `how_about_me`) and never in CI / production / staging. No override flag.
 * Never prints the URL (it carries the password) — only the database name and host.
 */
import { LOCAL_HOSTS, parseDatabaseTarget, PerfDbGuardError, type PerfDbTarget } from "../perf-seed/guard";

export class DemoSeedGuardError extends Error {}

export type DemoGuardEnv = { CI?: string; NODE_ENV?: string; APP_ENV?: string };

const BLOCKED_ENVS = new Set(["production", "staging"]);
const truthy = (v: string | undefined) => v !== undefined && v !== "" && v !== "0" && v.toLowerCase() !== "false";

export function assertDemoTarget(url: string | undefined, env: DemoGuardEnv): PerfDbTarget {
  if (truthy(env.CI)) throw new DemoSeedGuardError("refusing to run the demo seed in CI");
  for (const key of ["NODE_ENV", "APP_ENV"] as const) {
    const v = env[key]?.toLowerCase();
    if (v && BLOCKED_ENVS.has(v)) throw new DemoSeedGuardError(`refusing to run the demo seed with ${key}=${v}`);
  }
  let target: PerfDbTarget;
  try {
    target = parseDatabaseTarget(url);
  } catch (e) {
    const msg =
      e instanceof PerfDbGuardError
        ? e.message.replace("PERF_DATABASE_URL (or --database-url)", "DATABASE_URL")
        : "invalid database URL";
    throw new DemoSeedGuardError(msg);
  }
  if (!LOCAL_HOSTS.has(target.host)) {
    throw new DemoSeedGuardError(`refusing non-local host "${target.host}" (database "${target.databaseName}")`);
  }
  return target;
}
