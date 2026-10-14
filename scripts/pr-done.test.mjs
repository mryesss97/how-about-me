// Tests for the pure helpers of scripts/pr-done.mjs and
// scripts/lib/find-chrome.mjs. No git, no browser. Ported from
// live-stream-admin.
//
//   node --test scripts/pr-done.test.mjs
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { findChrome } from "./lib/find-chrome.mjs";
import {
  DARK_CLASS,
  DEFAULT_BASE_URL,
  DEFAULT_SIZE,
  DEFAULT_TIMEOUT_MS,
  DONE_HEADING,
  SHOT_FLAGS,
  SHOT_USAGE,
  clickTargets,
  doneSection,
  networkTracker,
  pairShots,
  parseShotArgs,
  parseSize,
  resolveShotUrl,
  touchesUi,
  splitTrailer,
  withoutSection,
} from "./pr-done.mjs";

test("touchesUi counts apps/web source", () => {
  assert.equal(touchesUi(["apps/web/src/features/mentions/mention-list.tsx"]), true);
  assert.equal(touchesUi(["apps/web/src/styles/globals.css"]), true);
});

test("touchesUi skips tests, test scaffolding, docs, other workspaces and markdown", () => {
  assert.equal(
    touchesUi([
      "apps/web/src/lib/api/client.test.ts",
      "apps/web/src/features/x/x.spec.tsx",
      "apps/web/src/lib/__mocks__/api.ts",
      "apps/web/src/test/setup.ts",
      "apps/web/src/components/README.md",
      "apps/web/e2e/smoke.spec.ts",
      "apps/web/next.config.ts",
      "apps/api/src/main.ts",
      "docs/01-product/09-ux-specification.md",
      "scripts/issue.mjs",
    ]),
    false,
  );
});

test("pairShots pairs before and after by name and reports a missing half", () => {
  const { complete, missing } = pairShots([
    "x/before-list.png",
    "x/after-list.png",
    "x/before-detail.png",
    "x/notes.txt",
  ]);
  assert.deepEqual(complete, [{ name: "list", before: "x/before-list.png", after: "x/after-list.png" }]);
  assert.deepEqual(missing, ["after-detail.png"]);
});

test("parseSize reads WxH and defaults to 1366x768", () => {
  assert.deepEqual(parseSize(undefined), DEFAULT_SIZE);
  assert.deepEqual(parseSize("390x844"), { width: 390, height: 844 });
  assert.throws(() => parseSize("big"), /1366x768/);
});

test("doneSection records the verify sha, e2e and a table of screenshots", () => {
  const text = doneSection({
    sha: "abc1234",
    links: [{ name: "list", before: "https://b", after: "https://a" }],
    e2e: true,
  });
  assert.ok(text.startsWith(DONE_HEADING));
  assert.match(text, /`pnpm verify` pass trên `abc1234`/);
  assert.match(text, /`pnpm test:e2e` pass/);
  assert.match(text, /\| list \| !\[trước: list\]\(https:\/\/b\) \| !\[sau: list\]\(https:\/\/a\) \|/);
});

test("doneSection says the repo has no e2e suite instead of ticking it", () => {
  const text = doneSection({ sha: "x", skipped: "Chỉ đổi docs." });
  assert.match(text, /- \[ \] E2E: repo chưa có script `test:e2e`/);
  assert.doesNotMatch(text, /test:e2e` pass/);
});

test("doneSection states why there is no screenshot", () => {
  assert.match(doneSection({ sha: "x", skipped: "Chỉ đổi docs." }), /không cần\. Chỉ đổi docs\./);
});

test("withoutSection drops the template placeholder and keeps the rest", () => {
  const body = [
    "## Summary",
    "x",
    "",
    "<!-- issue:ship writes this -->",
    "",
    DONE_HEADING,
    "- [ ] placeholder",
    "",
    "## Checklist",
    "- [x] y",
  ].join("\n");
  assert.equal(withoutSection(body, DONE_HEADING), ["## Summary", "x", "", "## Checklist", "- [x] y"].join("\n"));
  assert.equal(withoutSection("## Summary\nx", DONE_HEADING), "## Summary\nx");
  assert.equal(withoutSection(`a\n${DONE_HEADING}\n- [ ] z`, DONE_HEADING), "a");
  const template = readFileSync(new URL("../.github/PULL_REQUEST_TEMPLATE.md", import.meta.url), "utf8");
  assert.ok(template.includes(DONE_HEADING), "the PR template carries the section pr:create checks");
  const stripped = withoutSection(template, DONE_HEADING);
  assert.ok(!stripped.includes(DONE_HEADING));
  assert.doesNotMatch(stripped, /replaces this section/);
  assert.match(stripped, /## Checklist/);
});

const URL_ARGS = ["after", "list", "--url", "http://localhost:3000/mentions"];

test("parseShotArgs reads url, size, timeout and dark", () => {
  assert.deepEqual(parseShotArgs(URL_ARGS), {
    moment: "after",
    name: "list",
    url: "http://localhost:3000/mentions",
    size: DEFAULT_SIZE,
    timeout: DEFAULT_TIMEOUT_MS,
    dark: false,
    steps: [],
  });
  const parsed = parseShotArgs([...URL_ARGS, "--size", "800x600", "--timeout", "60000", "--dark"]);
  assert.deepEqual(parsed.size, { width: 800, height: 600 });
  assert.equal(parsed.timeout, 60000);
  assert.equal(parsed.dark, true);
});

test("parseShotArgs resolves a path against the web dev server", () => {
  assert.equal(DEFAULT_BASE_URL, "http://localhost:3000");
  assert.equal(
    parseShotArgs(["after", "x", "--url", "/mentions?q=a"], DEFAULT_BASE_URL).url,
    `${DEFAULT_BASE_URL}/mentions?q=a`,
  );
  assert.equal(resolveShotUrl("/a", "http://localhost:3101"), "http://localhost:3101/a");
});

test("parseShotArgs reads --file alone", () => {
  assert.deepEqual(parseShotArgs(["before", "x", "--file", "a.png"]), { moment: "before", name: "x", file: "a.png" });
});

test("parseShotArgs keeps steps in command-line order", () => {
  const { steps } = parseShotArgs([...URL_ARGS, "--wait-text", "a", "--click", "b", "--scroll", "c", "--click", "d"]);
  assert.deepEqual(steps, [
    { action: "waitText", text: "a" },
    { action: "click", text: "b" },
    { action: "scroll", text: "c" },
    { action: "click", text: "d" },
  ]);
});

test("parseShotArgs rejects a bad moment or name", () => {
  assert.throws(() => parseShotArgs(["middle", "x", "--url", "http://a"]));
  assert.throws(() => parseShotArgs(["after", "Bad_Name", "--url", "http://a"]));
});

test("parseShotArgs needs exactly one of url and file", () => {
  assert.throws(() => parseShotArgs(["after", "x"]), /đúng một/);
  assert.throws(() => parseShotArgs([...URL_ARGS, "--file", "a.png"]), /đúng một/);
});

test("parseShotArgs refuses a non-http url", () => {
  assert.throws(() => parseShotArgs(["after", "x", "--url", "localhost:3000/x"]));
  assert.throws(() => parseShotArgs(["after", "x", "--url", "file:///x"]));
  assert.throws(() => parseShotArgs(["after", "x", "--url", "not a url"]));
});

test("parseShotArgs refuses a flag with no value", () => {
  assert.throws(() => parseShotArgs(["after", "x", "--url"]), /Thiếu giá trị/);
  assert.throws(() => parseShotArgs([...URL_ARGS, "--click", "--dark"]), /Thiếu giá trị cho --click/);
});

test("parseShotArgs refuses a timeout out of range", () => {
  for (const timeout of ["abc", "0", "999999", "1.5"]) {
    assert.throws(() => parseShotArgs([...URL_ARGS, "--timeout", timeout]), /--timeout/);
  }
});

test("parseShotArgs refuses a repeated single-use flag", () => {
  assert.throws(() => parseShotArgs([...URL_ARGS, "--url", "http://b"]), /chỉ dùng một lần/);
  assert.throws(() => parseShotArgs([...URL_ARGS, "--dark", "--dark"]), /chỉ dùng một lần/);
});

test("parseShotArgs refuses capture flags next to --file", () => {
  assert.throws(() => parseShotArgs(["after", "x", "--file", "a.png", "--dark"]), /--file chỉ chép/);
  assert.throws(() => parseShotArgs(["after", "x", "--file", "a.png", "--click", "a"]), /--file chỉ chép/);
});

test("parseShotArgs refuses an unknown flag or a stray argument", () => {
  assert.throws(() => parseShotArgs([...URL_ARGS, "--full-page"]), /--full-page/);
  assert.throws(() => parseShotArgs([...URL_ARGS, "extra"]), /extra/);
});

test("parseShotArgs refuses an empty step text", () => {
  assert.throws(() => parseShotArgs([...URL_ARGS, "--click", "  "]), /rỗng/);
});

test("parseShotArgs refuses a size it cannot read", () => {
  assert.throws(() => parseShotArgs([...URL_ARGS, "--size", "big"]), /--size/);
});

test("clickTargets lists button, link, then text in priority order", () => {
  assert.deepEqual(clickTargets("Lưu thay đổi"), [
    { role: "button", name: "Lưu thay đổi", exact: true },
    { role: "link", name: "Lưu thay đổi", exact: true },
    { text: "Lưu thay đổi" },
  ]);
});

test("light only (#260): no theme provider sets DARK_CLASS, viewport pins light", () => {
  assert.equal(existsSync(new URL("../apps/web/src/providers/theme.tsx", import.meta.url)), false);
  const layout = readFileSync(new URL("../apps/web/src/app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /colorScheme: "light",/);
  assert.doesNotMatch(layout, /next-themes|enableSystem/);
  // DARK_CLASS is the vendored class `--dark` asserts is absent.
  assert.equal(DARK_CLASS, "dark-mode");
});

test("SHOT_USAGE lists every flag the parser accepts", () => {
  assert.equal(SHOT_FLAGS.length, 8);
  for (const flag of SHOT_FLAGS) {
    assert.ok(SHOT_USAGE.includes(flag), flag);
  }
});

/**
 * A page stand-in that emits request events, and a clock that moves only when
 * the tracker sleeps. `onTick(now)` runs after each sleep.
 */
function fakePage(onTick = () => {}) {
  const page = new EventEmitter();
  const clock = { now: 0 };
  const tracker = networkTracker(page, {
    now: () => clock.now,
    sleep: async (ms) => {
      clock.now += ms;
      onTick(clock.now, page);
    },
  });
  return { page, clock, tracker };
}

test("networkTracker waits until at most two requests stay open for the idle time", async () => {
  let finished = false;
  const { page, clock, tracker } = fakePage((now, emitter) => {
    if (now >= 1_000 && !finished) {
      finished = true;
      emitter.emit("requestfinished");
    }
  });
  for (let request = 0; request < 3; request += 1) page.emit("request");
  await tracker.idle({ idleTime: 500, concurrency: 2, timeout: 10_000 });
  assert.equal(tracker.inflight, 2);
  assert.ok(clock.now >= 1_500, `settled at ${clock.now}`);
});

test("networkTracker gives up after the timeout", async () => {
  const { page, tracker } = fakePage();
  for (let request = 0; request < 3; request += 1) page.emit("request");
  await assert.rejects(tracker.idle({ idleTime: 500, concurrency: 2, timeout: 1_000 }), /1000ms/);
  page.emit("requestfailed");
  page.emit("requestfailed");
  page.emit("requestfailed");
  page.emit("requestfailed");
  assert.equal(tracker.inflight, 0);
});

test("findChrome prefers CHROME_PATH, then Playwright's Chromium, then a system Chrome", () => {
  const has =
    (...paths) =>
    (path) =>
      paths.includes(path);
  const system = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  assert.equal(findChrome({ env: { CHROME_PATH: "/c" }, bundled: "/pw", exists: has("/c", "/pw") }), "/c");
  assert.equal(findChrome({ env: {}, bundled: "/pw", exists: has("/pw", system) }), "/pw");
  assert.equal(findChrome({ env: {}, bundled: "/pw", exists: has(system) }), system);
  assert.throws(() => findChrome({ env: {}, bundled: "/pw", exists: () => false }), /playwright install chromium/);
});

test("splitTrailer moves the attribution out so the Definition of Done placeholder cannot swallow it", () => {
  const body = [
    "## Summary",
    "x",
    "",
    DONE_HEADING,
    "- [ ] placeholder",
    "",
    "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
  ].join("\n");
  const { text, trailer } = splitTrailer(body);
  assert.equal(trailer, "🤖 Generated with [Claude Code](https://claude.com/claude-code)");
  assert.equal(withoutSection(text, DONE_HEADING).trimEnd(), "## Summary\nx");
});

test("splitTrailer leaves a body without a trailer unchanged", () => {
  assert.deepEqual(splitTrailer("## Summary\nx"), { text: "## Summary\nx", trailer: "" });
});
