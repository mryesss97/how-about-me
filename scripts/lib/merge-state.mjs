// Reads a PR's merge state after `gh pr merge`, waiting out GitHub's lag.
//
// `gh pr merge` returns before every GitHub read model shows the PR as MERGED.
// Read it once, straight away, and a freshly merged PR can still say OPEN,
// so `issue:finish` would skip closing its tickets.

/** Blocks the (synchronous) script for `ms` milliseconds. */
export function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Calls `read()` until it returns a PR whose `state` is MERGED, or a read
 * fails (`null`), or `attempts` run out. Returns the last PR read, or `null`
 * when a read failed; the caller decides what a non-MERGED result means.
 */
export function waitForMerged(read, { attempts = 6, delayMs = 2000, sleep = sleepSync } = {}) {
  let pr = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    pr = read();
    if (!pr || pr.state === "MERGED") return pr;
    if (attempt < attempts) sleep(delayMs);
  }
  return pr;
}
