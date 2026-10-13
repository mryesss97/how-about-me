// Tests for scripts/lib/verify-stamp.sh: the pre-push hook reuses a verify
// pass only for the exact commit, with a clean tree. Real git in a temp
// repo; no `pnpm verify`. Ported from live-stream-admin.
//
//   node --test scripts/verify-stamp.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";

const LIB = path.join(import.meta.dirname, "lib", "verify-stamp.sh");

let repo;

// Inside the pre-push hook git exports GIT_DIR, GIT_INDEX_FILE, GIT_WORK_TREE…
// Inherited, they point git at the real repo instead of the temp one.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));

const git = (...args) =>
  spawnSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    env: ENV,
  }).stdout.trim();

/** Run a bash snippet with the stamp functions loaded, inside the temp repo. */
const sh = (script) =>
  spawnSync("bash", ["-c", `. "${LIB}"; ${script}`], {
    cwd: repo,
    encoding: "utf8",
    env: ENV,
  });

function commit(name) {
  writeFileSync(path.join(repo, name), name);
  git("add", name);
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", name);
  return git("rev-parse", "HEAD");
}

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), "verify-stamp-"));
  git("init", "-q");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

test("a stamp for HEAD on a clean tree is valid", () => {
  const sha = commit("a");
  sh("write_verify_stamp");
  assert.equal(sh(`verify_stamp_valid ${sha}`).status, 0);
});

test("no stamp: the hook must run verify", () => {
  const sha = commit("a");
  assert.notEqual(sh(`verify_stamp_valid ${sha}`).status, 0);
});

test("a stamp for an older commit does not cover a newer one", () => {
  commit("a");
  sh("write_verify_stamp");
  const next = commit("b");
  assert.notEqual(sh(`verify_stamp_valid ${next}`).status, 0);
});

test("a pushed sha that is not HEAD is never covered", () => {
  const first = commit("a");
  commit("b");
  sh("write_verify_stamp");
  assert.notEqual(sh(`verify_stamp_valid ${first}`).status, 0);
});

test("a dirty tree writes no stamp and invalidates an old one", () => {
  const sha = commit("a");
  writeFileSync(path.join(repo, "a"), "changed");
  sh("write_verify_stamp");
  assert.notEqual(sh(`verify_stamp_valid ${sha}`).status, 0);

  git("checkout", "a");
  sh("write_verify_stamp");
  assert.equal(sh(`verify_stamp_valid ${sha}`).status, 0);
  writeFileSync(path.join(repo, "a"), "changed again");
  assert.notEqual(sh(`verify_stamp_valid ${sha}`).status, 0);
});

test("clear_verify_stamp forgets the pass", () => {
  const sha = commit("a");
  sh("write_verify_stamp");
  sh("clear_verify_stamp");
  assert.notEqual(sh(`verify_stamp_valid ${sha}`).status, 0);
});
