import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { resolveTestDatabaseUrl, testDatabaseName } from "./helpers/test-db";

/** Applies the committed migrations (baseline init + init_extras, T-007) to the per-worktree test database (#189). */
export default async function globalSetup() {
  const url = resolveTestDatabaseUrl();
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  process.stdout.write(`\ntest db: ${testDatabaseName(url)}\n`);
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    cwd: resolve(__dirname, ".."),
  });
}
