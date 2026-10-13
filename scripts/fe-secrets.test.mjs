// Tests for the FE secret scan (T-003, NFR-019; docs/02-architecture/08-security-secrets.md §9).
import { test } from "node:test";
import assert from "node:assert/strict";
import { scanEnv, scanText } from "./lib/fe-secrets.mjs";

const jwt = (payload) =>
  ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify(payload)).toString("base64url"), "sig"].join(".");

test("clean public env passes", () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" };
  assert.deepEqual(scanEnv(env, { buildEnv: true }), []);
});

test("server-only var in build env fails with --build-env (AC2)", () => {
  assert.equal(scanEnv({ SUPABASE_SERVICE_ROLE_KEY: "fake" }, { buildEnv: true }).length, 1);
  assert.equal(scanEnv({ SUPABASE_SERVICE_ROLE_KEY: "fake" }).length, 0);
});

test("NEXT_PUBLIC_ var with OpenAI key fails", () => {
  const problems = scanEnv({ NEXT_PUBLIC_OPENAI_KEY: "sk-abcdefghijklmnopqrstuvwx" });
  assert.ok(problems.some((p) => p.includes("OpenAI key")));
});

test("anon JWT passes, service_role JWT fails", () => {
  assert.deepEqual(scanEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: "anon" }) }), []);
  assert.equal(scanEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: "service_role" }) }).length, 1);
});

test("bundle containing a server-only secret value fails", () => {
  // Low-entropy placeholder built at runtime so gitleaks does not flag the fixture.
  const value = "placeholder".repeat(2);
  const env = { THREADS_ACCESS_TOKEN: value };
  assert.deepEqual(scanText(`const a="${value}"`, env), ["value of THREADS_ACCESS_TOKEN"]);
  assert.deepEqual(scanText("const a=1", env), []);
});

test("bundle containing forbidden name pattern fails", () => {
  assert.ok(scanText("process.env.SUPABASE_SERVICE_ROLE_KEY").length >= 1);
});
