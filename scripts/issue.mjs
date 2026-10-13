// The fixed steps of the issue loop, so an agent does not type them.
// Ported from live-stream-admin (which took it from 1zone-seatmap).
//
//   pnpm issue:start <ticket> <type> <summary words…>
//   pnpm issue:tidy
//   pnpm issue:ship --title "<subject>" --body-file <file>
//   pnpm issue:finish <PR>
//
// <ticket> is a GitHub issue number (12) or a backlog task id (T-049).
//
// start   fetch, cut a worktree off origin/develop, check the base, copy the
//         gitignored env files, install.
// tidy    prettier and eslint --fix on the files this branch changed.
// ship    run `pnpm test:e2e` when the root declares it, `pnpm verify:quiet`,
//         push (the pre-push hook reuses the verify result), then
//         `pnpm pr:create` with the "Definition of Done" section and the agent
//         cost of the linked tickets added.
// finish  squash-merge, close the tickets the PR closes, delete the remote
//         branch, remove the worktree.
//
// Long output stays out of the terminal: a failing step prints its last 50
// lines. docs/06-engineering/04-git-workflow.md §8 is the loop these run.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { costSection, readLedger } from "./agent.mjs";
import { waitForMerged } from "./lib/merge-state.mjs";
import { closingIssues, parseTicket, ticketsInBody } from "./lib/ticket.mjs";

/** Branch prefixes cut off develop (git workflow §1). hotfix and release are not. */
export const TYPES = ["feature", "fix", "refactor", "perf", "test", "docs", "chore", "spike"];
/** Branches nobody ships from: they are merge targets (git workflow §1). */
const PROTECTED = ["develop", "main"];
/** Gitignored files a fresh worktree needs, copied from the main checkout. */
const LOCAL_FILES = [".env", "apps/api/.env", "apps/web/.env.local", ".mcp.json"];
const LINT = /\.(ts|tsx|js|mjs|cjs)$/;
/** A branch that changes these files changes the UI and needs screenshots. */
const UI = /^apps\/web\/src\//;
export const DONE_HEADING = "## Definition of Done";
const TAIL = 50;

export function branchName(ticket, type, words) {
  if (!TYPES.includes(type)) throw new Error(`type "${type}" không hợp lệ. Dùng: ${TYPES.join(", ")}.`);
  const slug = words
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) throw new Error("Thiếu mô tả ngắn cho branch.");
  if (slug.split("-").length > 5) throw new Error(`Mô tả "${slug}" dài hơn 5 từ.`);
  return `${type}/${ticket.slug}-${slug}`;
}

/**
 * True when a push died on the network after the pre-push hook passed: GitHub
 * closed the SSH connection that sat idle while the hook ran. A hook that
 * failed, or any other push error, is not one: those must not be retried.
 */
export function isConnectionDropAfterGreenHook(output) {
  const text = String(output ?? "");
  const hookPassed = /verify: pass/.test(text) && !/verify: FAIL/.test(text);
  const dropped =
    /Connection to \S+ closed by remote host|Connection reset by peer|Broken pipe|Could not read from remote repository|the remote end hung up unexpectedly/i.test(
      text,
    );
  return hookPassed && dropped;
}

/**
 * Groups lintable files by the workspace that owns an ESLint config, with
 * paths relative to it. The root has no config: files outside a workspace
 * (scripts/) are not linted.
 */
export function lintGroups(files, hasConfig) {
  const groups = new Map();
  for (const file of files.filter((path) => LINT.test(path))) {
    let folder = dirname(file);
    while (folder !== "." && !hasConfig(folder)) folder = dirname(folder);
    if (folder === ".") continue;
    groups.set(folder, [...(groups.get(folder) ?? []), relative(folder, file)]);
  }
  return groups;
}

/** The PR body section `issue:ship` adds. `sha` is the commit verify passed on. */
export function doneSection({ sha, e2e, ui }) {
  return [
    DONE_HEADING,
    "",
    `- [x] \`pnpm verify\` pass trên \`${sha}\`: prisma generate · format:check · lint · typecheck · unit test · script test.`,
    e2e ? "- [x] `pnpm test:e2e` pass." : "- [ ] E2E: repo chưa có script `test:e2e` ở root.",
    ui
      ? "- [ ] UI: branch đổi `apps/web/src` — đính kèm ảnh trước/sau ở mục Screenshots."
      : "- [x] UI: branch không đổi `apps/web/src`, không cần ảnh.",
  ].join("\n");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
}

/** Runs a step; prints one line on success, the last 50 lines on failure. */
function step(label, command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status === 0) {
    console.log(`✓ ${label}`);
    return result.stdout;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trimEnd().split("\n");
  fail(`✗ ${label} — ${Math.min(TAIL, output.length)} dòng cuối:\n${output.slice(-TAIL).join("\n")}`);
}

function mainCheckout() {
  const common = run("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"]).stdout.trim();
  return dirname(common);
}

function start([text, type, ...words]) {
  let ticket;
  let branch;
  try {
    ticket = parseTicket(text);
    branch = branchName(ticket, type, words);
  } catch (error) {
    fail(error.message);
  }
  const main = mainCheckout();
  const path = join(dirname(main), `${basename(main)}-${ticket.slug}`);
  if (existsSync(path)) fail(`${path} đã tồn tại.`);
  step("git fetch origin", "git", ["fetch", "origin", "--quiet"]);
  step(`worktree ${path} · ${branch}`, "git", ["worktree", "add", "--no-track", "-b", branch, path, "origin/develop"]);
  step("git:check-base", "bash", ["scripts/check-base-branch.sh"], { cwd: path });
  for (const file of LOCAL_FILES) {
    if (!existsSync(join(main, file))) continue;
    mkdirSync(dirname(join(path, file)), { recursive: true });
    copyFileSync(join(main, file), join(path, file));
    console.log(`✓ chép ${file} từ checkout chính`);
  }
  step("pnpm install", "pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: path });
  console.log(path);
}

function changedFiles() {
  const base = run("git", ["merge-base", "HEAD", "origin/develop"]).stdout.trim();
  const tracked = run("git", ["diff", "--name-only", "--diff-filter=ACMR", base]).stdout;
  const untracked = run("git", ["ls-files", "--others", "--exclude-standard"]).stdout;
  return [...new Set(`${tracked}\n${untracked}`.split("\n").filter(Boolean))];
}

function hasEslintConfig(folder) {
  return ["eslint.config.mjs", "eslint.config.js"].some((name) => existsSync(join(folder, name)));
}

function tidy() {
  const files = changedFiles().filter((file) => existsSync(file));
  // The whole repo is prettier-clean (`pnpm format:check`), so every changed
  // file may be rewritten; .prettierignore still applies.
  if (files.length)
    step(`prettier · ${files.length} file`, "pnpm", [
      "exec",
      "prettier",
      "--write",
      "--ignore-unknown",
      "--log-level",
      "warn",
      ...files,
    ]);
  for (const [folder, lint] of lintGroups(files, hasEslintConfig)) {
    step(
      `eslint --fix · ${folder} · ${lint.length} file`,
      "pnpm",
      ["exec", "eslint", "--fix", "--no-warn-ignored", ...lint],
      {
        cwd: folder,
      },
    );
  }
  const dirty = run("git", ["status", "--short"]).stdout.trimEnd();
  console.log(dirty ? `File đã đổi, cần commit:\n${dirty}` : "Không còn gì cần sửa.");
}

function optionValue(args, name) {
  const position = args.indexOf(name);
  return position === -1 ? undefined : args[position + 1];
}

function withoutOption(args, name) {
  const position = args.indexOf(name);
  return position === -1 ? args : [...args.slice(0, position), ...args.slice(position + 2)];
}

/** Whether the root package.json declares `test:e2e`. */
function hasE2e() {
  try {
    return Boolean(JSON.parse(readFileSync("package.json", "utf8")).scripts?.["test:e2e"]);
  } catch {
    return false;
  }
}

/**
 * Pushes the branch. Verify runs first and leaves a stamp for this commit, so
 * the pre-push hook reuses it and takes seconds (scripts/lib/verify-stamp.sh):
 * a long hook leaves the SSH connection idle and GitHub closes it. The hook
 * still runs gitleaks every time, and runs verify in full when the stamp does
 * not match. If the connection drops anyway after a green hook, push once
 * more; the hook then reuses the same stamp. No `--no-verify`.
 */
function push(branch) {
  step("verify · pnpm verify:quiet (hook dùng lại kết quả)", "bash", ["scripts/verify-quiet.sh"]);
  const args = ["push", "--set-upstream", "origin", branch];
  const label = `git push · gitleaks trong hook · ${branch}`;
  const result = run("git", args);
  if (result.status === 0) {
    console.log(`✓ ${label}`);
    return;
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (isConnectionDropAfterGreenHook(output)) {
    console.log("! GitHub đóng kết nối sau hook xanh. Push lại một lần.");
    step(`${label} (lần 2)`, "git", args);
    return;
  }
  const lines = output.trimEnd().split("\n");
  fail(`✗ ${label} — ${Math.min(TAIL, lines.length)} dòng cuối:\n${lines.slice(-TAIL).join("\n")}`);
}

function ship(args) {
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  if (PROTECTED.includes(branch)) fail(`Không ship từ ${branch}. Chạy pnpm issue:start trước.`);
  if (run("git", ["status", "--porcelain"]).stdout.trim()) fail("Còn thay đổi chưa commit. Commit rồi chạy lại.");
  const bodyFile = optionValue(args, "--body-file");
  if (!bodyFile) fail("Thiếu --body-file <file>.");
  const e2e = hasE2e();
  if (e2e) step("E2E · pnpm test:e2e", "pnpm", ["test:e2e"]);
  push(branch);
  const sha = run("git", ["rev-parse", "--short", "HEAD"]).stdout.trim();
  const done = doneSection({ sha, e2e, ui: changedFiles().some((file) => UI.test(file)) });
  const text = readFileSync(bodyFile, "utf8").trimEnd();
  // The tickets this PR closes, the same keywords `pr:create` checks.
  const cost = costSection(readLedger(), ticketsInBody(text));
  const gitDir = run("git", ["rev-parse", "--git-dir"]).stdout.trim();
  const body = join(gitDir, "pr-body.md");
  writeFileSync(body, `${text}\n\n${done}\n\n${cost}\n`);
  args = withoutOption(args, "--body-file");
  args.push("--body-file", body);
  const hasBase = args.some((arg) => arg === "--base" || arg.startsWith("--base="));
  const pr = step("pr:create", "node", ["scripts/pr-create.mjs", ...(hasBase ? [] : ["--base", "develop"]), ...args]);
  console.log(pr.trim().split("\n").pop());
}

/**
 * Closes the tickets a merged PR names with `Closes #N`. GitHub does this by
 * itself only for PRs into the default branch (`main`); every other PR goes
 * into `develop`, so without this no ticket of the loop ever closes. A failure
 * here only warns: the branch and worktree cleanup must still run.
 */
function closeTickets(pr, body) {
  const issues = closingIssues(body);
  if (issues.length === 0) return;
  // GitHub can still report OPEN right after `gh pr merge`: re-read until it
  // says MERGED instead of trusting the first answer.
  const merged = waitForMerged(() => {
    const view = run("gh", ["pr", "view", pr, "--json", "state,baseRefName,mergeCommit"]);
    return view.status === 0 ? JSON.parse(view.stdout) : null;
  });
  const manual = issues.map((issue) => `gh issue close ${issue}`).join(" && ");
  if (!merged) {
    console.warn(`! không đọc lại được PR #${pr}; chưa đóng ticket. Chạy tay: ${manual}`);
    return;
  }
  const { state, baseRefName, mergeCommit } = merged;
  if (state !== "MERGED") {
    console.warn(`! PR #${pr} vẫn ở trạng thái ${state}; chưa đóng ticket. Merge xong thì chạy tay: ${manual}`);
    return;
  }
  const sha = String(mergeCommit?.oid ?? "").slice(0, 7);
  for (const issue of issues) {
    const view = run("gh", ["issue", "view", issue, "--json", "state"]);
    if (view.status === 0 && JSON.parse(view.stdout).state === "CLOSED") continue;
    const comment = `Đã merge vào ${baseRefName} qua #${pr}${sha ? ` (${sha})` : ""}.`;
    const close = run("gh", ["issue", "close", issue, "--comment", comment]);
    if (close.status === 0) {
      console.log(`✓ đóng ticket #${issue}`);
    } else {
      console.warn(`! chưa đóng được ticket #${issue}. Chạy tay: gh issue close ${issue} --comment "${comment}"`);
    }
  }
}

function finish([pr]) {
  if (!/^\d+$/.test(pr ?? "")) fail("Dùng: pnpm issue:finish <PR>");
  const view = step(`đọc PR #${pr}`, "gh", ["pr", "view", pr, "--json", "headRefName,state,body"]);
  const { headRefName: branch, state, body } = JSON.parse(view);
  if (state === "OPEN") step(`squash-merge #${pr}`, "gh", ["pr", "merge", pr, "--squash"]);
  closeTickets(pr, body);
  run("git", ["push", "origin", "--delete", branch]);
  const main = mainCheckout();
  const worktrees = run("git", ["worktree", "list", "--porcelain"]).stdout;
  const path = worktrees
    .split("\n\n")
    .find((block) => block.includes(`branch refs/heads/${branch}`))
    ?.match(/^worktree (.+)$/m)?.[1];
  if (path && path !== main) step(`gỡ worktree ${path}`, "git", ["worktree", "remove", path], { cwd: main });
  run("git", ["branch", "-D", branch], { cwd: main });
  step("git fetch origin", "git", ["fetch", "origin", "--prune", "--quiet"], { cwd: main });
  console.log(`Xong #${pr}. Ticket tiếp theo: pnpm issue:start <ticket> <type> <mô tả>`);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  // pnpm forwards a leading `--` as an argument; drop it.
  const [command, ...rest] = process.argv.slice(2).filter((arg, index) => !(index === 1 && arg === "--"));
  const commands = { start, tidy, ship, finish };
  if (!commands[command]) fail("Dùng: issue.mjs <start|tidy|ship|finish>");
  await commands[command](rest);
}
