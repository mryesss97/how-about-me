// Tests for the pure helpers of scripts/agent.mjs, scripts/issue.mjs and
// scripts/lib/ticket.mjs. No git, no gh, no claude. The other script tests
// sit next to this file (`pnpm agent:test` runs them all).
//
//   node --test scripts/agent-workflow.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  cliIsRecent,
  codePrompt,
  COST_HEADING,
  costSection,
  extractQaReport,
  HAIKU,
  missingReportMessage,
  OPUS,
  pickModel,
  SMALL_DIFF_LINES,
  summarize,
} from "./agent.mjs";
import { branchName, isConnectionDropAfterGreenHook, lintGroups } from "./issue.mjs";
import { closingIssues, parseTicket, ticketsInBody } from "./lib/ticket.mjs";

const MAP = { "T-049": { number: 128 } };

test("parseTicket reads a GitHub issue number with or without #", () => {
  assert.deepEqual(parseTicket("12", MAP), { kind: "github", id: "12", ref: "#12", slug: "12", task: undefined });
  assert.equal(parseTicket("#12", MAP).ref, "#12");
});

test("parseTicket resolves a backlog task id through the issue map", () => {
  assert.deepEqual(parseTicket("t-049", MAP), { kind: "github", id: "128", ref: "#128", slug: "128", task: "T-049" });
  assert.throws(() => parseTicket("T-999", MAP), /T-999 chưa có/);
});

test("parseTicket rejects text that is neither", () => {
  assert.throws(() => parseTicket("collector window", MAP), /không phải ticket/);
  assert.throws(() => parseTicket(undefined, MAP), /không phải ticket/);
});

test("parseTicket reads the real issue map", () => {
  assert.equal(parseTicket("T-001").ref, "#1");
});

test("ticketsInBody keeps closing keywords only, not Refs: #N", () => {
  const body = ["Closes #12", "fixes #12", "Resolved #14", "Refs: #99"].join("\n");
  assert.deepEqual(ticketsInBody(body), ["#12", "#14"]);
});

test("closingIssues returns every issue the body closes, in order, once", () => {
  assert.deepEqual(closingIssues(["Closes #12", "Fixes #13", "closes #12", "RESOLVES #14"].join("\n")), [
    "12",
    "13",
    "14",
  ]);
});

test("closingIssues ignores Refs: lines", () => {
  assert.deepEqual(closingIssues("Refs: #93\nSee #94"), []);
});

test("closingIssues ignores issues of another repository and empty bodies", () => {
  assert.deepEqual(closingIssues("Closes mryesss97/other#5\nCloses #96"), ["96"]);
  assert.deepEqual(closingIssues(""), []);
  assert.deepEqual(closingIssues(undefined), []);
});

test("lintGroups lints a file from the workspace that owns the ESLint config", () => {
  const groups = lintGroups(
    ["apps/api/src/a.service.ts", "apps/web/src/app/page.tsx", "scripts/issue.mjs", "docs/README.md"],
    (folder) => folder === "apps/api" || folder === "apps/web",
  );
  assert.deepEqual(
    [...groups.entries()],
    [
      ["apps/api", ["src/a.service.ts"]],
      ["apps/web", ["src/app/page.tsx"]],
    ],
  );
});

test("triage runs on Haiku without an effort level", () => {
  assert.deepEqual(pickModel("triage"), { model: HAIKU });
});

test("plan runs on Opus low, and Opus high only for a hard ticket", () => {
  assert.equal(pickModel("plan").effort, "low");
  assert.deepEqual(pickModel("plan", { hard: true }), { model: OPUS, effort: "high", agent: "researcher" });
});

test("code always runs on Opus low", () => {
  assert.deepEqual(pickModel("code", { hard: true }), { model: OPUS, effort: "low", agent: "coder" });
});

test("review picks Haiku for a small diff and Opus low above the limit", () => {
  assert.equal(pickModel("review", { diffLines: SMALL_DIFF_LINES }).model, HAIKU);
  assert.deepEqual(pickModel("review", { diffLines: SMALL_DIFF_LINES + 1 }), {
    model: OPUS,
    effort: "low",
    agent: "qa-tester",
  });
});

test("an unknown stage throws", () => {
  assert.throws(() => pickModel("deploy"), /deploy/);
});

test("summarize sums cost per ticket, label and stage", () => {
  const entries = [
    { ticket: "#1", title: "a", labels: ["area: api"], stage: "code", model: OPUS, effort: "low", costUsd: 1.5 },
    { ticket: "#1", title: "a", labels: ["area: api"], stage: "triage", model: HAIKU, effort: null, costUsd: 0.5 },
    { ticket: "#2", title: "b", labels: [], stage: "code", model: OPUS, effort: "low", costUsd: 3 },
  ];
  const { byTicket, byLabel, byStage } = summarize(entries);
  assert.equal(byTicket.get("#1 a").usd, 2);
  assert.equal(byLabel.get("area: api").tickets.size, 1);
  assert.equal(byLabel.get("(no label)").usd, 3);
  assert.equal(byStage.get(`code · ${OPUS} low`).runs, 2);
});

test("models are full ids, not aliases", () => {
  assert.match(HAIKU, /^claude-haiku-/);
  assert.match(OPUS, /^claude-opus-/);
});

test("cliIsRecent compares the CLI version with MIN_CLI", () => {
  assert.equal(cliIsRecent("2.1.210 (Claude Code)"), false);
  assert.equal(cliIsRecent("2.1.280 (Claude Code)"), true);
  assert.equal(cliIsRecent("2.2.0 (Claude Code)"), true);
  assert.equal(cliIsRecent(""), false);
});

test("branchName builds <type>/<issue>-<slug> and strips Vietnamese marks", () => {
  assert.equal(
    branchName(parseTicket("71", MAP), "feature", ["Đo", "cửa sổ", "collector"]),
    "feature/71-do-cua-so-collector",
  );
  assert.equal(branchName(parseTicket("T-049", MAP), "fix", ["window", "overlap"]), "fix/128-window-overlap");
});

test("branchName rejects a bad type and a long summary", () => {
  const ticket = parseTicket("1", MAP);
  assert.throws(() => branchName(ticket, "feat", ["x"]), /feat/);
  assert.throws(() => branchName(ticket, "chore", ["a b c d e f"]), /5 từ/);
  assert.throws(() => branchName(ticket, "chore", []), /Thiếu mô tả/);
});

const RUN = {
  ticket: "#7",
  stage: "code",
  model: OPUS,
  ran: [OPUS],
  effort: "low",
  costUsd: 1.234,
  turns: 12,
  durationMs: 61_400,
  isError: false,
};

test("costSection lists the runs of the linked tickets and their total", () => {
  const text = costSection(
    [
      RUN,
      { ...RUN, ticket: "#8", costUsd: 9 },
      { ...RUN, stage: "triage", model: HAIKU, ran: [], effort: null, costUsd: 0.066 },
    ],
    ["#7"],
  );
  assert.ok(text.startsWith(COST_HEADING));
  assert.match(text, /\| #7 \| code \| `claude-opus-5-5` \| low \| \$1\.23 \| 12 \| 61 s \|/);
  assert.match(text, /\| #7 \| triage \| `claude-haiku-4-5-20251001` \| — \| \$0\.07 \|/);
  assert.match(text, /\*\*Tổng\*\* \| 2 lượt .*\*\*\$1\.30\*\*/);
  assert.doesNotMatch(text, /#8/);
});

test("costSection shows the model that really ran and marks a failed run", () => {
  const text = costSection([{ ...RUN, model: "haiku", ran: ["claude-sonnet-5"], isError: true }], ["#7"]);
  assert.match(text, /\| code \(error\) \| `claude-sonnet-5` \|/);
});

test("costSection says so when the ticket has no run", () => {
  assert.match(costSection([RUN], ["#9"]), /Không có lượt chạy `pnpm agent` nào cho #9\./);
});

test("interactive agents declare the model of their stage", () => {
  const frontmatter = (name) => {
    const text = readFileSync(new URL(`../.claude/agents/${name}.md`, import.meta.url), "utf8");
    const head = text.split("\n---\n")[0];
    const field = (key) => head.match(new RegExp(`^${key}: (.+)$`, "m"))?.[1];
    return { model: field("model"), effort: field("effort") };
  };
  const plan = pickModel("plan");
  const code = pickModel("code");
  const review = pickModel("review", { diffLines: 0 });
  assert.deepEqual(frontmatter("researcher"), { model: plan.model, effort: plan.effort });
  assert.deepEqual(frontmatter("coder"), { model: code.model, effort: code.effort });
  assert.deepEqual(frontmatter("qa-tester"), { model: review.model, effort: undefined });
});

test("extractQaReport keeps the report and drops the chatter before it", () => {
  const result = "Xong rồi.\n\n# Báo cáo QA: #12\n\n## Kết quả: PASS\n\nKhông có blocker.";
  assert.equal(extractQaReport(result), "# Báo cáo QA: #12\n\n## Kết quả: PASS\n\nKhông có blocker.\n");
});

test("extractQaReport returns null without the heading or a verdict", () => {
  assert.equal(extractQaReport("Tôi có được phép viết không?"), null);
  assert.equal(extractQaReport("# Báo cáo QA: #12\n\nChưa xong."), null);
  assert.equal(extractQaReport(undefined), null);
});

test("missingReportMessage names the stage and the file", () => {
  const message = missingReportMessage("review", ".claude/runs/qa-12.md");
  assert.match(message, /review/);
  assert.match(message, /\.claude\/runs\/qa-12\.md/);
});

test("isConnectionDropAfterGreenHook retries only a drop after a green hook", () => {
  const green = "gitleaks: pass\nverify: pass (log: x)\n";
  const drop = "Connection to github.com closed by remote host.\nerror: failed to push some refs";
  assert.equal(isConnectionDropAfterGreenHook(green + drop), true);
  // The hook failed: the red check stands, no retry.
  assert.equal(isConnectionDropAfterGreenHook("verify: FAIL — 50 dòng cuối\n" + drop), false);
  // The hook never reached verify: not a green hook.
  assert.equal(isConnectionDropAfterGreenHook(drop), false);
  // Another push error after a green hook: no retry.
  assert.equal(isConnectionDropAfterGreenHook(green + "! [rejected] non-fast-forward"), false);
  assert.equal(isConnectionDropAfterGreenHook(undefined), false);
});

test("codePrompt implements the plan when there is no failed QA report", () => {
  const ticket = { ref: "#12", slug: "12" };
  for (const report of [null, "# Báo cáo QA: x\n\n## Kết quả: PASS\n"]) {
    const text = codePrompt(ticket, report);
    assert.match(text, /^Implement the approved plan \.claude\/runs\/research-12\.md/);
    assert.doesNotMatch(text, /qa-12/);
  }
});

test("codePrompt fixes the QA blockers after a failed review", () => {
  const text = codePrompt({ ref: "#12", slug: "12" }, "# Báo cáo QA: x\n\n## Kết quả: FAIL\n\n## Blockers\n1. y\n");
  assert.match(text, /Fix every blocker in \.claude\/runs\/qa-12\.md/);
  assert.match(text, /research-12\.md/);
  assert.match(text, /pnpm verify:quiet/);
});
