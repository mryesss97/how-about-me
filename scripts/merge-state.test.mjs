// Tests for scripts/lib/merge-state.mjs. No gh, no network, no real waiting.
// Ported from live-stream-admin.
//
//   node --test scripts/merge-state.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { waitForMerged } from "./lib/merge-state.mjs";

/** A reader that returns the given states in order, and counts its sleeps. */
function sequence(...states) {
  const reads = [...states];
  const calls = { reads: 0, sleeps: [] };
  const read = () => {
    calls.reads += 1;
    const state = reads.shift();
    return state === null ? null : { state };
  };
  const sleep = (ms) => calls.sleeps.push(ms);
  return { read, sleep, calls };
}

test("waitForMerged keeps reading while GitHub still says OPEN after the merge", () => {
  const { read, sleep, calls } = sequence("OPEN", "OPEN", "MERGED");

  const pr = waitForMerged(read, { attempts: 5, delayMs: 10, sleep });

  assert.equal(pr.state, "MERGED");
  assert.equal(calls.reads, 3);
  assert.deepEqual(calls.sleeps, [10, 10]);
});

test("waitForMerged returns at once when the first read is MERGED", () => {
  const { read, sleep, calls } = sequence("MERGED");

  assert.equal(waitForMerged(read, { sleep }).state, "MERGED");
  assert.equal(calls.reads, 1);
  assert.deepEqual(calls.sleeps, []);
});

test("waitForMerged gives back the last state when attempts run out, without a trailing sleep", () => {
  const { read, sleep, calls } = sequence("OPEN", "OPEN", "OPEN");

  const pr = waitForMerged(read, { attempts: 3, delayMs: 5, sleep });

  assert.equal(pr.state, "OPEN");
  assert.equal(calls.reads, 3);
  assert.deepEqual(calls.sleeps, [5, 5]);
});

test("waitForMerged stops on a failed read and returns null", () => {
  const { read, sleep, calls } = sequence("OPEN", null, "MERGED");

  assert.equal(waitForMerged(read, { attempts: 5, sleep }), null);
  assert.equal(calls.reads, 2);
});
