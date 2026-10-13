// Run one stage of the implementation pipeline headless and log its cost.
// Ported from live-stream-admin (which took it from 1zone-seatmap).
//
//   pnpm agent triage <ticket>
//   pnpm agent plan <ticket> [--hard] [-- <extra claude args>]
//   pnpm agent code <ticket>
//   pnpm agent review <ticket>
//   pnpm agent cost [ticket]
//
// <ticket> is a GitHub issue number (12) or a backlog task id (T-049).
//
// The script picks the model, so an agent never chooses its own. Every run
// appends one line to `.claude/runs/agent-costs.jsonl` in the main checkout:
// all worktrees share it, git ignores it. `cost` sums it per ticket and label.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { parseTicket } from "./lib/ticket.mjs";

// Full ids, never aliases: on CLI 2.1.210 `haiku` ran claude-sonnet-5 and
// `opus` ran claude-opus-4-8. The ledger records the model that really ran.
export const HAIKU = "claude-haiku-4-5-20251001";
export const OPUS = "claude-opus-5-5";
/** Opus 5.5 needs this CLI version or newer; older ones answer API 400. */
export const MIN_CLI = [2, 1, 280];
/** A review of a diff up to this many changed lines runs on Haiku. */
export const SMALL_DIFF_LINES = 200;
/** Triage areas when the repo has no `area: *` label (.github/labels.yml). */
export const DEFAULT_AREAS = [
  "area: api",
  "area: web",
  "area: contracts",
  "area: taxonomy",
  "area: ai",
  "area: db",
  "area: infra",
  "area: docs",
  "area: qa",
];
const STAGES = ["triage", "plan", "code", "review"];
/** Stage output lives in the worktree; only the cost ledger is shared. */
const RUNS = join(".claude", "runs");
/** The file each stage must leave in `RUNS`; triage writes its own JSON. */
const REPORT_PREFIX = { plan: "research", code: "impl", review: "qa" };
/** First line of the QA report, as `.claude/agents/qa-tester.md` defines it. */
export const QA_REPORT_HEADING = "# Báo cáo QA";
/** Lock files count as noise when sizing a diff. */
const DIFF_EXCLUDE = [":(exclude)pnpm-lock.yaml"];

/**
 * The QA report inside the final message of a review run, or `null`.
 *
 * Why the script writes this file: a headless `claude -p --permission-mode auto`
 * run on Haiku cannot write under `.claude/` (the CLI treats it as a sensitive
 * path and asks for confirmation nobody can give), and Haiku may even say "done"
 * after the refusal. Opus passes the auto-mode check, Haiku does not. Only
 * `bypassPermissions` lets Haiku write there, which is too wide for a stage that
 * runs Bash. So the agent returns the report and the script saves it.
 */
export function extractQaReport(result) {
  const text = String(result ?? "");
  const start = text.indexOf(QA_REPORT_HEADING);
  if (start === -1) return null;
  const report = text.slice(start).trim();
  return /\b(PASS|FAIL)\b/.test(report) ? `${report}\n` : null;
}

/** What the script prints when a stage left no report file. */
export function missingReportMessage(stage, path) {
  return `Stage ${stage} không để lại báo cáo: ${path}. Chạy lại stage, hoặc ghi file này bằng tay từ output ở trên.`;
}

/**
 * Model and effort per stage. Haiku takes no effort level. Opus `high`
 * is for the plan of a ticket triage marked hard, nothing else.
 */
export function pickModel(stage, { hard = false, diffLines = 0 } = {}) {
  switch (stage) {
    case "triage":
      return { model: HAIKU };
    case "plan":
      return { model: OPUS, effort: hard ? "high" : "low", agent: "researcher" };
    case "code":
      return { model: OPUS, effort: "low", agent: "coder" };
    case "review":
      return diffLines <= SMALL_DIFF_LINES
        ? { model: HAIKU, agent: "qa-tester" }
        : { model: OPUS, effort: "low", agent: "qa-tester" };
    default:
      throw new Error(`Không có stage "${stage}". Dùng: triage, plan, code, review, cost.`);
  }
}

/** True when `claude --version` output is at least MIN_CLI. */
export function cliIsRecent(versionOutput) {
  const parts = versionOutput
    .match(/(\d+)\.(\d+)\.(\d+)/)
    ?.slice(1)
    .map(Number);
  if (!parts) return false;
  for (const [index, part] of parts.entries()) {
    if (part !== MIN_CLI[index]) return part > MIN_CLI[index];
  }
  return true;
}

/** Sums ledger lines by ticket, by label and by stage. */
export function summarize(entries) {
  const add = (map, key, entry) => {
    const row = map.get(key) ?? { usd: 0, runs: 0, tickets: new Set() };
    row.usd += entry.costUsd;
    row.runs += 1;
    row.tickets.add(entry.ticket);
    map.set(key, row);
  };
  const byTicket = new Map();
  const byLabel = new Map();
  const byStage = new Map();
  for (const entry of entries) {
    add(byTicket, `${entry.ticket} ${entry.title ?? ""}`.trim(), entry);
    for (const label of entry.labels?.length ? entry.labels : ["(no label)"]) {
      add(byLabel, label, entry);
    }
    add(byStage, `${entry.stage} · ${entry.model}${entry.effort ? ` ${entry.effort}` : ""}`, entry);
  }
  return { byTicket, byLabel, byStage };
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function mainCheckout() {
  const common = run("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (common.status !== 0) fail("Không ở trong repo git.");
  return dirname(common.stdout.trim());
}

export function ledgerPath() {
  return join(mainCheckout(), ".claude", "runs", "agent-costs.jsonl");
}

/** Every ledger line, oldest first. An empty list when there is no ledger. */
export function readLedger() {
  try {
    return readFileSync(ledgerPath(), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export const COST_HEADING = "## Chi phí agent";

/**
 * The PR body section: every `pnpm agent` run of the tickets the PR
 * closes, and their total. Runs after `issue:ship` are not in it.
 */
export function costSection(entries, refs) {
  const runs = entries.filter((entry) => refs.includes(entry.ticket));
  const tickets = refs.join(", ") || "PR này";
  if (runs.length === 0) {
    return [
      COST_HEADING,
      "",
      `Không có lượt chạy \`pnpm agent\` nào cho ${tickets}. Chi phí của session tương tác không đo được.`,
    ].join("\n");
  }
  const lines = [
    COST_HEADING,
    "",
    `Các lượt \`pnpm agent\` cho ${tickets}, tính tới lúc tạo PR. Nguồn: \`total_cost_usd\` của \`claude -p --output-format json\`.`,
    "",
    "| Ticket | Stage | Model | Effort | USD | Lượt | Thời gian |",
    "| --- | --- | --- | --- | ---: | ---: | ---: |",
  ];
  let total = 0;
  for (const entry of runs) {
    total += entry.costUsd;
    const model = entry.ran?.length ? entry.ran.join(", ") : entry.model;
    const seconds = entry.durationMs ? `${Math.round(entry.durationMs / 1000)} s` : "—";
    const stage = entry.isError ? `${entry.stage} (error)` : entry.stage;
    lines.push(
      `| ${entry.ticket} | ${stage} | \`${model}\` | ${entry.effort ?? "—"} | $${entry.costUsd.toFixed(2)} | ${entry.turns ?? "—"} | ${seconds} |`,
    );
  }
  lines.push(`| **Tổng** | ${runs.length} lượt | | | **$${total.toFixed(2)}** | | |`);
  return lines.join("\n");
}

function readIssue(ticket) {
  const result = run("gh", ["issue", "view", ticket.id, "--json", "title,body,labels"]);
  if (result.status !== 0) fail(`Không đọc được issue ${ticket.ref}: ${result.stderr.trim()}`);
  const issue = JSON.parse(result.stdout);
  return { title: issue.title, body: issue.body, labels: issue.labels.map((label) => label.name) };
}

function diffLines() {
  const base = run("git", ["merge-base", "HEAD", "origin/develop"]).stdout.trim();
  const stat = run("git", ["diff", "--numstat", base, "--", ".", ...DIFF_EXCLUDE]).stdout;
  return stat
    .split("\n")
    .filter(Boolean)
    .reduce((total, line) => {
      const [added, removed] = line.split("\t");
      return total + (Number(added) || 0) + (Number(removed) || 0);
    }, 0);
}

function areas() {
  const result = run("gh", ["label", "list", "--limit", "100", "--json", "name", "--jq", ".[].name"]);
  const labels = (result.stdout ?? "").split("\n").filter((name) => name.startsWith("area:"));
  return labels.length ? labels : DEFAULT_AREAS;
}

/** The QA report of the last review run in this worktree, or `null`. */
function readQaReport(ticket) {
  const path = join(RUNS, `qa-${ticket.slug}.md`);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/**
 * The code stage implements the plan, or, after a review that failed, fixes
 * what the QA report lists. This is the "FAIL → fix → re-review" step of the
 * continuous loop (.claude/WORKFLOW.md), so it runs without anyone in between.
 */
export function codePrompt(ticket, qaReport) {
  const plan = `.claude/runs/research-${ticket.slug}.md`;
  const impl = `.claude/runs/impl-${ticket.slug}.md`;
  const verify = "Run `pnpm verify:quiet`, never the full log.";
  if (qaReport && /^## Kết quả:\s*FAIL/m.test(qaReport)) {
    return `QA failed ticket ${ticket.ref}. Fix every blocker in .claude/runs/qa-${ticket.slug}.md, and the warnings that are cheap to fix, keeping to the plan ${plan}. Append what you changed to ${impl} under "## Sửa sau QA". ${verify}`;
  }
  return `Implement the approved plan ${plan} for ticket ${ticket.ref}. Write ${impl}. ${verify}`;
}

function prompt(stage, ticket, issue) {
  const source = `Ticket ${ticket.ref}: ${issue.title}\n\n${issue.body}`;
  switch (stage) {
    case "triage":
      return [
        "Triage this ticket. Read only the files you need. Do not edit anything.",
        'Answer with one JSON object and nothing else: {"type": "feature|fix|refactor|perf|test|docs|chore|spike",',
        `"area": "${areas().join("|")}", "size": "S|M|L", "hard": true|false, "reason": "<one sentence>"}.`,
        "hard = true only when the plan needs a design decision, an API contract or data model change that the docs do not settle, or touches more than one workspace.",
        "",
        source,
      ].join("\n");
    case "plan":
      return `Plan ${source}\n\nWrite the plan to .claude/runs/research-${ticket.slug}.md.`;
    case "code":
      return codePrompt(ticket, readQaReport(ticket));
    case "review":
      // The agent must not write the report: a Haiku run cannot write under
      // .claude/. It returns the report and the script saves it (extractQaReport).
      return `Review the diff of this branch against origin/develop for ticket ${ticket.ref} and the plan .claude/runs/research-${ticket.slug}.md. Do not write any file. Make your final message the complete QA report in the format of your agent file, starting with the line "${QA_REPORT_HEADING}: ..." and nothing before it.`;
    default:
      throw new Error(stage);
  }
}

function triageSaysHard(ticket) {
  try {
    const path = join(RUNS, `triage-${ticket.slug}.json`);
    return JSON.parse(readFileSync(path, "utf8")).hard === true;
  } catch {
    return false;
  }
}

function runStage(stage, ticket, rest) {
  const split = rest.indexOf("--");
  const flags = split === -1 ? rest : rest.slice(0, split);
  const extra = split === -1 ? [] : rest.slice(split + 1);
  const issue = readIssue(ticket);
  const hard = flags.includes("--hard") || (stage === "plan" && triageSaysHard(ticket));
  const choice = pickModel(stage, { hard, diffLines: stage === "review" ? diffLines() : 0 });

  const version = run("claude", ["--version"]).stdout ?? "";
  if (choice.model === OPUS && !cliIsRecent(version)) {
    fail(
      `claude ${version.trim() || "(không có)"} không chạy được ${OPUS}: cần ≥ ${MIN_CLI.join(".")}. Chạy: claude update`,
    );
  }

  const args = ["-p", prompt(stage, ticket, issue), "--model", choice.model, "--output-format", "json"];
  if (choice.effort) args.push("--effort", choice.effort);
  if (choice.agent) args.push("--agent", choice.agent);
  args.push("--permission-mode", stage === "triage" ? "plan" : "auto");
  // No MCP server and no skill: each one adds its tool list to every turn,
  // and no stage needs them. CLAUDE.md and the agent file still load.
  args.push("--strict-mcp-config", "--disable-slash-commands", ...extra);

  console.error(`agent: ${stage} ${ticket.ref} · ${choice.model}${choice.effort ? ` ${choice.effort}` : ""}`);
  const startedAt = Date.now();
  const result = run("claude", args, { stdio: ["ignore", "pipe", "inherit"] });
  let output;
  try {
    output = JSON.parse(result.stdout);
  } catch {
    fail(
      `claude không trả JSON (exit ${result.status}). 50 dòng cuối:\n${String(result.stdout ?? "")
        .split("\n")
        .slice(-50)
        .join("\n")}`,
    );
  }

  const entry = {
    at: new Date().toISOString(),
    ticket: ticket.ref,
    title: issue.title,
    labels: issue.labels,
    stage,
    model: choice.model,
    ran: Object.keys(output.modelUsage ?? {}),
    effort: choice.effort ?? null,
    costUsd: output.total_cost_usd ?? 0,
    durationMs: output.duration_ms ?? null,
    turns: output.num_turns ?? null,
    isError: output.is_error === true,
    sessionId: output.session_id ?? null,
  };
  const ledger = ledgerPath();
  mkdirSync(dirname(ledger), { recursive: true });
  appendFileSync(ledger, `${JSON.stringify(entry)}\n`);

  if (stage === "triage") {
    const json = String(output.result ?? "").match(/\{[\s\S]*\}/)?.[0];
    if (json) {
      mkdirSync(RUNS, { recursive: true });
      writeFileSync(join(RUNS, `triage-${ticket.slug}.json`), `${json}\n`);
    }
  }
  console.log(output.result ?? "");
  console.error(`agent: $${entry.costUsd.toFixed(4)} · ${entry.turns ?? "?"} lượt · ghi vào ${ledger}`);
  if (!entry.isError && REPORT_PREFIX[stage]) {
    const reportPath = join(RUNS, `${REPORT_PREFIX[stage]}-${ticket.slug}.md`);
    const written = existsSync(reportPath) && statSync(reportPath).mtimeMs >= startedAt;
    const report = stage === "review" ? extractQaReport(output.result) : null;
    if (!written && report) {
      mkdirSync(RUNS, { recursive: true });
      writeFileSync(reportPath, report);
      console.error(`agent: đã ghi ${reportPath}`);
    } else if (!written) {
      console.error(missingReportMessage(stage, reportPath));
      process.exit(1);
    }
  }
  process.exit(entry.isError ? 1 : 0);
}

function printTable(title, map) {
  console.log(`\n${title}`);
  const rows = [...map.entries()].sort((left, right) => right[1].usd - left[1].usd);
  for (const [key, row] of rows) {
    const perTicket = row.usd / row.tickets.size;
    console.log(
      `  ${key.slice(0, 48).padEnd(48)} $${row.usd.toFixed(2).padStart(8)}  ${String(row.runs).padStart(3)} lượt  $${perTicket.toFixed(2)}/ticket`,
    );
  }
}

function report(text) {
  const ref = text ? parseTicket(text).ref : undefined;
  const entries = readLedger().filter((entry) => !ref || entry.ticket === ref);
  if (entries.length === 0)
    fail(ref ? `Chưa có lượt chạy nào cho ${ref}.` : `Sổ chi phí rỗng hoặc chưa có: ${ledgerPath()}.`);
  const { byTicket, byLabel, byStage } = summarize(entries);
  printTable("Theo ticket", byTicket);
  printTable("Theo label", byLabel);
  printTable("Theo stage và model", byStage);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  // pnpm forwards a leading `--` as an argument; drop it.
  const argv = process.argv.slice(2);
  if (argv[0] === "--") argv.shift();
  const [stage, text, ...rest] = argv;
  const usage = "Dùng: pnpm agent <triage|plan|code|review> <ticket> | cost [ticket]";
  try {
    if (stage === "cost") report(text);
    else if (!STAGES.includes(stage)) fail(usage);
    else runStage(stage, parseTicket(text), rest);
  } catch (error) {
    fail(`${error.message}\n${usage}`);
  }
}
