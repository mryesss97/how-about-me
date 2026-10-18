/**
 * Target-database guard for the perf seed / explain CLIs (T-097). They TRUNCATE and bulk-load, so they refuse any
 * database whose name lacks a `perf` or `test` marker, or a non-local host, unless `--allow-any-db` is passed.
 * Never prints the URL (it carries the password) — only the database name.
 */
export class PerfDbGuardError extends Error {}

export const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
/** `perf` / `test` as a whole `_`/`-` separated word (so `contest_prod` does not pass). */
const MARKER = /(^|[_-])(perf|test)([_-]|$)/i;

export type PerfDbTarget = { databaseName: string; host: string };

export function parseDatabaseTarget(url: string | undefined): PerfDbTarget {
  if (!url) throw new PerfDbGuardError("PERF_DATABASE_URL (or --database-url) is not set");
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new PerfDbGuardError("database URL cannot be parsed");
  }
  if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") {
    throw new PerfDbGuardError("database URL must be postgresql://");
  }
  const databaseName = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!databaseName) throw new PerfDbGuardError("database URL has no database name");
  return { databaseName, host: u.hostname };
}

export function assertPerfDatabase(url: string | undefined, opts: { allowAnyDb: boolean }): PerfDbTarget {
  const t = parseDatabaseTarget(url);
  if (opts.allowAnyDb) return t;
  if (!MARKER.test(t.databaseName)) {
    throw new PerfDbGuardError(
      `refusing database "${t.databaseName}": name has no perf/test marker (pass --allow-any-db to override)`,
    );
  }
  if (!LOCAL_HOSTS.has(t.host)) {
    throw new PerfDbGuardError(`refusing non-local host "${t.host}" (pass --allow-any-db to override)`);
  }
  return t;
}
