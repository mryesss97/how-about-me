// Tests for scripts/lib/verify-lock.sh. Real bash processes, a temp lock path,
// a short poll interval; no git, no `pnpm verify`. Ported from live-stream-admin.
//
//   node --test scripts/verify-lock.test.mjs
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";

const LIB = path.join(import.meta.dirname, "lib", "verify-lock.sh");
const POLL = "0.05";

let dir;
let lock;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "verify-lock-"));
  lock = path.join(dir, "verify.lock");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait until `check()` is true, polling every 20 ms, failing after `ms`. */
async function until(check, ms = 5000) {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("timed out waiting");
    await sleep(20);
  }
}

const lockExists = () => {
  try {
    lstatSync(lock);
    return true;
  } catch {
    return false;
  }
};

/**
 * Start a bash process that holds the lock like verify-quiet.sh does, prints
 * "got" once it has it, then runs `body`. Its own process group, so a signal
 * to the group models Ctrl-C in a terminal.
 */
function holder(body) {
  const script = `. "${LIB}"; hold_verify_lock_until_exit "${lock}"; echo got; ${body}`;
  const child = spawn("bash", ["-c", script], {
    detached: true,
    env: { ...process.env, VERIFY_LOCK_POLL: POLL },
  });
  const run = { child, out: "", exit: null };
  child.stdout.on("data", (chunk) => {
    run.out += chunk;
  });
  child.on("exit", (code, signal) => {
    run.exit = { code, signal };
  });
  return run;
}

test("a second verify waits for the first and says so once", async () => {
  const first = holder("sleep 0.6");
  await until(() => first.out.includes("got"));

  const second = holder("true");
  await sleep(300);
  assert.equal(second.out.includes("got"), false, "second ran while first held the lock");
  const waitLines = second.out.split("\n").filter((line) => line.includes("đang chờ verify"));
  assert.equal(waitLines.length, 1);
  assert.match(waitLines[0], new RegExp(`PID ${first.child.pid}`));

  await until(() => second.exit !== null);
  assert.equal(first.exit?.code, 0);
  assert.equal(second.exit.code, 0);
  assert.ok(second.out.includes("got"));
  assert.equal(lockExists(), false, "lock left behind after both finished");
});

test("Ctrl-C frees the lock so the next verify does not hang", async () => {
  const first = holder("sleep 30");
  await until(() => first.out.includes("got"));
  assert.equal(readlinkSync(lock), String(first.child.pid));

  process.kill(-first.child.pid, "SIGINT");
  await until(() => first.exit !== null);
  assert.equal(lockExists(), false);

  const next = holder("true");
  await until(() => next.exit !== null);
  assert.equal(next.exit.code, 0);
  assert.equal(next.out.includes("đang chờ verify"), false);
});

test("a failing verify still frees the lock", async () => {
  const run = holder("exit 1");
  await until(() => run.exit !== null);
  assert.equal(run.exit.code, 1);
  assert.equal(lockExists(), false);
});

test("a lock left by a process that no longer runs is reclaimed without waiting", async () => {
  // A finished process: its PID no longer runs a verify.
  const gone = spawnSync("bash", ["-c", "echo $$"], { encoding: "utf8" });
  symlinkSync(gone.stdout.trim(), lock);

  const run = holder("true");
  await until(() => run.exit !== null);
  assert.equal(run.exit.code, 0);
  assert.equal(run.out.includes("đang chờ verify"), false);
  assert.equal(existsSync(lock), false);
});

test("a lock whose PID now belongs to an unrelated process is reclaimed", async () => {
  // PID reuse after a reboot: the PID runs, but not a verify.
  const unrelated = spawn("sleep", ["5"]);
  symlinkSync(String(unrelated.pid), lock);
  try {
    const run = holder("true");
    await until(() => run.exit !== null);
    assert.equal(run.exit.code, 0);
    assert.equal(run.out.includes("đang chờ verify"), false);
  } finally {
    unrelated.kill();
  }
});
