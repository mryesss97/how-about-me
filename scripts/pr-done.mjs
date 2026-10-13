// Definition of Done for every PR. Ported from live-stream-admin (which took
// it from 1zone-seatmap). docs/03-delivery/05-definition-of-ready-done.md has
// the full list; this file holds the part a script checks.
//
// 1. `pnpm verify` passes: `issue:ship` runs it and the pre-push hook reuses
//    the result.
// 2. E2E passes: `pnpm test:e2e`, once the root declares it. Until then the
//    PR body says so instead of skipping it silently.
// 3. A PR that changes the UI shows a screenshot before and after the change.
//
// `pnpm issue:ship` runs 2 and 3 and writes the "Definition of Done" section
// into the PR body. `pnpm pr:create` refuses a body without it.
//
// GitHub has no upload API for PR images. Screenshots go to the orphan branch
// `pr-assets`, one folder per branch; the PR links them with
// `blob/pr-assets/…?raw=true`, which renders for everyone who can read the repo.
// The pre-push hook skips that branch: it holds no code.
//
// The browser is the Playwright that apps/web uses for e2e. The reference repo
// uses puppeteer-core, which this repo does not install.
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";

export const ASSETS_BRANCH = "pr-assets";
export const DONE_HEADING = "## Definition of Done";
/** Where `pnpm issue:shot` keeps the PNGs of the current worktree (gitignored). */
export const SHOTS_DIR = join(".claude", "runs", "shots");
/** The layout every UI PR checks. */
export const DEFAULT_SIZE = { width: 1366, height: 768 };
/** `pnpm dev` serves apps/web here. `--url /path` resolves against it. */
export const DEFAULT_BASE_URL = "http://localhost:3000";

/** A branch that changes these files changes the UI and needs screenshots. */
export const UI = /^apps\/web\/src\//;
/** Tests, test scaffolding and docs inside the UI tree do not count. */
const NOT_UI = /\.(test|spec|e2e)\.tsx?$|\.md$|\/__(tests|mocks)__\/|^apps\/web\/src\/test\//;

export function touchesUi(files) {
  return files.some((file) => UI.test(file) && !NOT_UI.test(file));
}

/** Pairs `before-<name>.png` with `after-<name>.png`. */
export function pairShots(files) {
  const names = new Map();
  for (const file of files) {
    const match = basename(file).match(/^(before|after)-(.+)\.png$/);
    if (!match) continue;
    const pair = names.get(match[2]) ?? {};
    pair[match[1]] = file;
    names.set(match[2], pair);
  }
  const complete = [];
  const missing = [];
  for (const [name, pair] of names) {
    if (pair.before && pair.after) complete.push({ name, ...pair });
    else missing.push(`${pair.before ? "after" : "before"}-${name}.png`);
  }
  return { complete, missing };
}

export function parseSize(text) {
  if (!text) return DEFAULT_SIZE;
  const match = text.match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`--size "${text}" sai. Viết dạng 1366x768.`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * `--url` as given, or a path (`/dashboard`) on `base`: SHOT_BASE_URL, else
 * the web dev server on port 3000. Only http and https.
 */
export function resolveShotUrl(text, base = process.env.SHOT_BASE_URL || DEFAULT_BASE_URL) {
  let url;
  try {
    url = text.startsWith("/") ? new URL(text, base) : new URL(text);
  } catch {
    throw new Error(`--url "${text}" không phải URL hợp lệ.`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`--url "${text}" phải bắt đầu bằng http://, https:// hoặc /.`);
  }
  return url.href;
}

export const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 300_000;
/**
 * apps/web/src/providers/theme.tsx: next-themes puts this class on <html> in
 * dark mode and follows the system scheme by default (`enableSystem`), so
 * `--dark` emulates `prefers-color-scheme: dark`. A test keeps them in step.
 */
export const DARK_CLASS = "dark-mode";

export const SHOT_USAGE = [
  "Dùng: pnpm issue:shot <before|after> <name-kebab>",
  "  (--url <url|/path> [--size 1366x768] [--timeout 30000] [--dark]",
  '     [--wait-text "<chữ>"] [--click "<nhãn>"] [--scroll "<chữ>"] ... | --file <png>)',
].join("\n");

const VALUE_FLAGS = new Set(["--url", "--file", "--size", "--timeout"]);
export const STEP_FLAGS = {
  "--wait-text": "waitText",
  "--click": "click",
  "--scroll": "scroll",
};

/** Every flag `parseShotArgs` accepts. */
export const SHOT_FLAGS = [...VALUE_FLAGS, "--dark", ...Object.keys(STEP_FLAGS)];

/**
 * Reads the arguments after `issue:shot`. Throws an Error with a Vietnamese
 * message on anything it does not understand: an unknown flag that is ignored
 * silently produces the wrong screenshot.
 */
export function parseShotArgs(argv, base) {
  const [moment, name, ...rest] = argv;
  if (!["before", "after"].includes(moment) || !/^[a-z0-9-]+$/.test(name ?? "")) {
    throw new Error("Thiếu <before|after> hoặc <name-kebab> sai.");
  }
  const single = {};
  let dark = false;
  const steps = [];
  for (let position = 0; position < rest.length; position += 1) {
    const flag = rest[position];
    if (flag === "--dark") {
      if (dark) throw new Error("--dark chỉ dùng một lần.");
      dark = true;
      continue;
    }
    const isStep = flag in STEP_FLAGS;
    if (!isStep && !VALUE_FLAGS.has(flag)) {
      throw new Error(`Không hiểu tham số "${flag}".`);
    }
    const value = rest[position + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Thiếu giá trị cho ${flag}.`);
    }
    position += 1;
    if (isStep) {
      const text = value.trim();
      if (!text) throw new Error(`Chữ của ${flag} rỗng.`);
      steps.push({ action: STEP_FLAGS[flag], text });
      continue;
    }
    if (flag in single) throw new Error(`${flag} chỉ dùng một lần.`);
    single[flag] = value;
  }
  const url = single["--url"];
  const file = single["--file"];
  if (Boolean(url) === Boolean(file)) {
    throw new Error("Dùng đúng một trong --url, --file.");
  }
  if (file) {
    if (single["--size"] || single["--timeout"] || dark || steps.length) {
      throw new Error("--file chỉ chép ảnh có sẵn, không đi cùng --size, --timeout, --dark hay bước nào.");
    }
    return { moment, name, file };
  }
  let timeout = DEFAULT_TIMEOUT_MS;
  if (single["--timeout"] !== undefined) {
    const text = single["--timeout"];
    timeout = Number(text);
    if (!/^\d+$/.test(text) || timeout < MIN_TIMEOUT_MS || timeout > MAX_TIMEOUT_MS) {
      throw new Error(`--timeout "${text}" sai. Viết số ms từ ${MIN_TIMEOUT_MS} đến ${MAX_TIMEOUT_MS}.`);
    }
  }
  return {
    moment,
    name,
    url: resolveShotUrl(url, base),
    size: parseSize(single["--size"]),
    timeout,
    dark,
    steps,
  };
}

/**
 * What `--click "<label>"` tries, in priority order: a button, then a link,
 * by exact accessible name; then the smallest element whose text contains it.
 */
export function clickTargets(label) {
  return [{ role: "button", name: label, exact: true }, { role: "link", name: label, exact: true }, { text: label }];
}

function locate(page, target) {
  return target.role
    ? page.getByRole(target.role, { name: target.name, exact: target.exact }).first()
    : page.getByText(target.text).first();
}

/**
 * The PR body section. `sha` is the commit verify passed on. `links` maps a
 * shot name to its before/after URLs; `skipped` is the reason when there are
 * none. `e2e` is false while the root has no `test:e2e` script.
 */
export function doneSection({ sha, e2e = false, links = [], skipped }) {
  const lines = [
    DONE_HEADING,
    "",
    `- [x] \`pnpm verify\` pass trên \`${sha}\`: prisma generate · format:check · lint · typecheck · unit test · script test.`,
    e2e ? "- [x] `pnpm test:e2e` pass." : "- [ ] E2E: repo chưa có script `test:e2e` ở root, không chạy.",
  ];
  if (links.length === 0) {
    lines.push(`- [x] Screenshot trước và sau: không cần. ${skipped}`);
    return lines.join("\n");
  }
  lines.push("- [x] Screenshot trước và sau:", "");
  lines.push("| Màn | Trước | Sau |", "| --- | --- | --- |");
  for (const link of links) {
    lines.push(`| ${link.name} | ![trước: ${link.name}](${link.before}) | ![sau: ${link.name}](${link.after}) |`);
  }
  return lines.join("\n");
}

/** `text` without the `## ` section that starts with `heading`, up to the next `## `. */
/** A line that signs the PR body, e.g. the "Generated with Claude Code" attribution. */
const TRAILER = /^🤖 Generated with \[[^\]]+\]\([^)]+\)\s*$/;

/**
 * Splits trailer lines (the attribution) out of a PR body so they can go last
 * again after `issue:ship` replaces the Definition of Done placeholder, which
 * otherwise swallows everything after it.
 */
export function splitTrailer(text) {
  const lines = String(text).split("\n");
  const trailer = lines.filter((line) => TRAILER.test(line.trim())).map((line) => line.trim());
  const rest = lines.filter((line) => !TRAILER.test(line.trim())).join("\n");
  return { text: rest, trailer: [...new Set(trailer)].join("\n") };
}

export function withoutSection(text, heading) {
  const lines = String(text).split("\n");
  const start = lines.findIndex((line) => line.trimEnd() === heading);
  if (start === -1) return text;
  const after = lines.slice(start + 1).findIndex((line) => /^## /.test(line));
  const end = after === -1 ? lines.length : start + 1 + after;
  // An HTML comment above the heading, blank lines apart, belongs to it.
  let from = start;
  let above = start - 1;
  while (above >= 0 && lines[above].trim() === "") above -= 1;
  if (above >= 0 && /^<!--.*-->$/.test(lines[above].trim())) from = above;
  return [...lines.slice(0, from), ...lines.slice(end)].join("\n");
}

export function listShots() {
  try {
    return readdirSync(SHOTS_DIR)
      .filter((file) => file.endsWith(".png"))
      .map((file) => join(SHOTS_DIR, file));
  } catch {
    return [];
  }
}

export function clearShots() {
  rmSync(SHOTS_DIR, { recursive: true, force: true });
}

/**
 * Counts the requests in flight, so a shot can wait until at most
 * `concurrency` are open for `idleTime` ms (puppeteer's `networkidle2`;
 * Playwright only has `networkidle`, which waits for zero). A dev server keeps
 * a connection or two open for hot reload.
 */
export function networkTracker(page, { now = Date.now, sleep } = {}) {
  let inflight = 0;
  const up = () => {
    inflight += 1;
  };
  const down = () => {
    inflight = Math.max(0, inflight - 1);
  };
  page.on("request", up);
  page.on("requestfinished", down);
  page.on("requestfailed", down);
  const pause = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  return {
    get inflight() {
      return inflight;
    },
    async idle({ idleTime = 500, concurrency = 2, timeout }) {
      const deadline = now() + timeout;
      let quietSince = null;
      while (now() < deadline) {
        if (inflight <= concurrency) {
          quietSince ??= now();
          if (now() - quietSince >= idleTime) return;
        } else {
          quietSince = null;
        }
        await pause(50);
      }
      throw new Error(`Timed out after waiting ${timeout}ms for the network to settle`);
    },
  };
}

const STEP_NAMES = { waitText: "wait-text", click: "click", scroll: "scroll" };

/**
 * Clicks the first of `clickTargets(label)` that matches a visible element,
 * checked in order on each poll, so a button beats text that merely contains
 * the label. Gives up after `timeout` ms.
 */
async function clickInOrder(page, label, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const target of clickTargets(label)) {
      const locator = locate(page, target);
      if (await locator.isVisible()) {
        await locator.click({ timeout: Math.max(1, deadline - Date.now()) });
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out after waiting ${timeout}ms`);
}

async function runStep(page, network, step, timeout) {
  const visibleText = () => locate(page, { text: step.text });
  if (step.action === "waitText") {
    await visibleText().waitFor({ state: "visible", timeout });
  } else if (step.action === "click") {
    await clickInOrder(page, step.text, timeout);
    // A click often fires a request (save, open a modal that loads data).
    await network.idle({ idleTime: 500, concurrency: 2, timeout });
  } else {
    const element = visibleText();
    await element.waitFor({ state: "visible", timeout });
    await element.scrollIntoViewIfNeeded({ timeout });
  }
}

/**
 * Writes a PNG of `url` at `size`.
 *
 * Waits for `load`, then a best-effort 5 s for the network to settle, so a
 * slow asset does not block the shot; screens that load data late need
 * `--wait-text`. Animations are off through `prefers-reduced-motion`. A
 * failed step throws and no screenshot is written.
 */
export async function capture({ url, out, size, timeout, dark, steps }) {
  const { loadPlaywright, launchChrome } = await import("./lib/find-chrome.mjs");
  const { chromium } = loadPlaywright();
  mkdirSync(SHOTS_DIR, { recursive: true });
  const browser = await launchChrome(chromium);
  try {
    const context = await browser.newContext({
      viewport: size,
      reducedMotion: "reduce",
      colorScheme: dark ? "dark" : "light",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
    const network = networkTracker(page);
    await page.goto(url, { waitUntil: "load" });
    await network.idle({ idleTime: 500, concurrency: 2, timeout: Math.min(5_000, timeout) }).catch(() => {});
    if (dark) {
      const isDark = await page.evaluate((name) => document.documentElement.classList.contains(name), DARK_CLASS);
      if (!isDark) {
        throw new Error(
          `--dark: app không theo dark mode (thiếu class ${DARK_CLASS} trên <html>), xem apps/web/src/providers/theme.tsx.`,
        );
      }
    }
    for (const [position, step] of steps.entries()) {
      try {
        await runStep(page, network, step, timeout);
      } catch (error) {
        throw new Error(
          `bước ${position + 1}/${steps.length} ${STEP_NAMES[step.action]} "${step.text}": ${error.message}`,
        );
      }
    }
    await page.screenshot({ path: out });
  } finally {
    await browser.close();
  }
}

function git(args, env = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

/**
 * Commits `files` under `<folder>/` on `pr-assets` without a checkout and
 * pushes it. Returns a URL per file, in the same order.
 */
export function uploadShots(files, folder, repo) {
  const ref = `refs/remotes/origin/${ASSETS_BRANCH}`;
  spawnSync("git", ["fetch", "--quiet", "origin", `+${ASSETS_BRANCH}:${ref}`]);
  const parent = spawnSync("git", ["rev-parse", "--verify", "--quiet", ref], {
    encoding: "utf8",
  }).stdout.trim();

  const index = join(git(["rev-parse", "--git-dir"]), "pr-assets.index");
  const env = { GIT_INDEX_FILE: index };
  rmSync(index, { force: true });
  if (parent) git(["read-tree", parent], env);
  const paths = files.map((file) => `${folder}/${basename(file)}`);
  for (const [position, file] of files.entries()) {
    const blob = git(["hash-object", "-w", file]);
    git(["update-index", "--add", "--cacheinfo", `100644,${blob},${paths[position]}`], env);
  }
  const tree = git(["write-tree"], env);
  rmSync(index, { force: true });
  const commit = git([
    "commit-tree",
    tree,
    ...(parent ? ["-p", parent] : []),
    "-m",
    `chore: screenshots for ${folder}`,
  ]);
  git(["push", "--quiet", "origin", `${commit}:refs/heads/${ASSETS_BRANCH}`]);
  return paths.map((path) => `https://github.com/${repo}/blob/${ASSETS_BRANCH}/${path}?raw=true`);
}
