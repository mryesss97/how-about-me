import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/** Applies migrations to the test database (falls back to `db push` before the baseline migration exists — T-007). */
export default async function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/how_about_me_test?schema=public";
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  const migrations = resolve(__dirname, "../prisma/migrations");
  const hasMigrations = existsSync(migrations) && readdirSync(migrations).some((d) => /^\d{14}_/.test(d));
  execSync(hasMigrations ? "npx prisma migrate deploy" : "npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env,
    cwd: resolve(__dirname, ".."),
  });
}
