// Open a PR only when its body closes a real issue and the branch, title and
// target follow the git workflow. Ported from live-stream-admin.
//
// A PR merged without a closing keyword leaves its GitHub issue open. The
// check runs here, before `gh pr create`.
//
//   pnpm pr:create --base develop --title "<subject>" --body-file <file>
//   pnpm pr:check --base develop --title "<subject>" --body-file <file>
//
// The body needs `Closes #12` (or fixes / resolves), checked with `gh`: the
// number exists and is an issue. Every argument except --check-only and
// --no-issue goes to `gh pr create` unchanged. --no-issue skips the ticket
// check; use it sparingly. Branches release/* and hotfix/* are exempt.
//
// The body must also carry the "Definition of Done" section (only release/*
// is exempt). `pnpm issue:ship` writes it; a PR opened by hand fills the one in
// .github/PULL_REQUEST_TEMPLATE.md.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { conventionProblems } from "./lib/pr-conventions.mjs";
import { ticketsInBody } from "./lib/ticket.mjs";
import { DONE_HEADING } from "./pr-done.mjs";

const EXEMPT = /^(release|hotfix)\//;
/** A release PR only moves reviewed code to main; it adds no change to check. */
const DONE_EXEMPT = /^release\//;

function fail(lines) {
  console.error(lines.join("\n"));
  process.exit(1);
}

function run(command, args) {
  return spawnSync(command, args, { encoding: "utf8" });
}

function optionValue(args, names) {
  for (const [index, arg] of args.entries()) {
    for (const name of names) {
      if (arg === name) return args[index + 1];
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
    }
  }
  return undefined;
}

function readBody(args) {
  const bodyFile = optionValue(args, ["--body-file", "-F"]);
  if (bodyFile === "-") fail(["--body-file - không được hỗ trợ: script và gh không cùng đọc được stdin."]);
  if (bodyFile !== undefined) return readFileSync(bodyFile, "utf8");
  const body = optionValue(args, ["--body", "-b"]);
  if (body !== undefined) return body;
  fail([
    "Không có mô tả PR. Truyền --body-file <file> hoặc --body <text>.",
    "`gh pr create --fill` không được hỗ trợ: mô tả phải link issue.",
  ]);
}

function headBranch(args) {
  const head = optionValue(args, ["--head", "-H"]);
  if (head !== undefined) return head.split(":").pop();
  return run("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
}

function checkIssues(refs) {
  const problems = [];
  for (const ref of refs) {
    const number = ref.slice(1);
    const result = run("gh", [
      "api",
      `repos/{owner}/{repo}/issues/${number}`,
      "--jq",
      "[.state, (.pull_request != null), .title] | @tsv",
    ]);
    if (result.status !== 0) {
      problems.push(
        /404|Not Found/.test(result.stderr)
          ? `${ref} không tồn tại — gõ nhầm số?`
          : `${ref}: không đọc được (${result.stderr.trim()}).`,
      );
      continue;
    }
    const [state, isPullRequest, title] = result.stdout.trim().split("\t");
    if (isPullRequest === "true") {
      problems.push(`${ref} là một pull request, không phải issue.`);
    } else if (state === "closed") {
      console.warn(`⚠️ ${ref} đã đóng sẵn trước khi PR này merge.`);
    } else {
      console.log(`✓ ${ref} — ${title}`);
    }
  }
  if (problems.length > 0) fail(problems);
}

function checkTicket(args) {
  const branch = headBranch(args);
  if (EXEMPT.test(branch)) {
    console.log(`Bỏ qua kiểm tra issue: '${branch}' là nhánh release/hotfix.`);
    return;
  }
  const tickets = ticketsInBody(readBody(args));
  if (tickets.length === 0) {
    fail([
      "Mô tả PR không đóng issue nào.",
      "",
      "Thêm một dòng vào mục ## Issue: Closes #12",
      "Từ khoá: closes / fixes / resolves (kể cả close, fixed, resolved). `Refs: #12` KHÔNG tính.",
      "",
      "Nếu PR thật sự không thuộc issue nào, thêm --no-issue.",
    ]);
  }
  checkIssues(tickets);
}

function checkConventions(args) {
  const problems = conventionProblems({
    branch: headBranch(args),
    title: optionValue(args, ["--title", "-t"]),
    base: optionValue(args, ["--base", "-B"]),
  });
  if (problems.length > 0) fail(problems);
  console.log("✓ branch · title · target đúng git workflow");
}

function checkDone(args) {
  if (DONE_EXEMPT.test(headBranch(args))) return;
  const lines = readBody(args).split("\n");
  if (lines.some((line) => line.trimEnd() === DONE_HEADING)) return;
  fail([
    `Mô tả PR thiếu mục "${DONE_HEADING}".`,
    "Tạo PR bằng `pnpm issue:ship`: script đẩy screenshot và tự thêm mục này.",
    "Tạo tay thì điền mục đó trong .github/PULL_REQUEST_TEMPLATE.md (git workflow §3).",
  ]);
}

let args = process.argv.slice(2);
if (args[0] === "--") args = args.slice(1);
const checkOnly = args.includes("--check-only");
const noIssue = args.includes("--no-issue");
const ghArgs = args.filter((arg) => arg !== "--check-only" && arg !== "--no-issue");

checkConventions(ghArgs);
if (noIssue) console.log("Bỏ qua kiểm tra issue: --no-issue.");
else checkTicket(ghArgs);
checkDone(ghArgs);

if (!checkOnly) {
  const result = spawnSync("gh", ["pr", "create", ...ghArgs], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
