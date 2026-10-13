import { execSync } from "node:child_process";
import { resolve } from "node:path";

/** Applies the committed migrations (baseline init + init_extras, T-007) to the test database. */
export default async function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/how_about_me_test?schema=public";
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    cwd: resolve(__dirname, ".."),
  });
}
