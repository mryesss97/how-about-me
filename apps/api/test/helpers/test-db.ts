import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { PrismaService } from "../../src/database/prisma.service";

/**
 * Test database URL (#189). `TEST_DATABASE_URL` wins (CI); otherwise each worktree gets its own database
 * `how_about_me_test_<sha1(git toplevel)[0:8]>` so parallel worktrees never TRUNCATE each other's data.
 * `prisma migrate deploy` creates the database when it does not exist yet.
 */
export function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  let root = process.cwd();
  try {
    root = execSync("git rev-parse --show-toplevel", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    // Not a git checkout: fall back to cwd.
  }
  const hash = createHash("sha1").update(root).digest("hex").slice(0, 8);
  return `postgresql://postgres:postgres@localhost:5432/how_about_me_test_${hash}?schema=public`;
}

/** Database name only — never log the full URL (it carries the password). */
export function testDatabaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

/**
 * Waits until Postgres `now()` has reached `at` (max 5 s). Node and the DB (Docker VM) clocks may drift,
 * so tests comparing a Node-computed timestamp with `now()` must wait on the DB clock (#189).
 */
export async function waitForDbTime(prisma: PrismaService, at: Date): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const [row] = await prisma.$queryRaw<{ ok: boolean }[]>`SELECT now() >= ${at} AS ok`;
    if (row?.ok) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`DB clock did not reach ${at.toISOString()} within 5 s`);
}
