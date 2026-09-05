#!/usr/bin/env node
/**
 * Sync docs/03-delivery/backlog.json → GitHub labels, milestones and issues (one issue per task).
 * Idempotent: issues are matched by the `[T-###]` title prefix and updated in place.
 * Requires: `gh auth login` with repo scope. Usage: pnpm issues:sync [--dry-run] [--only T-001,T-002]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const only = (args.find((a) => a.startsWith("--only=")) || "").replace("--only=", "").split(",").filter(Boolean);
const backlog = JSON.parse(readFileSync(resolve(root, "docs/03-delivery/backlog.json"), "utf8"));
const REPO = backlog.repo;
const BASE = backlog.docsBaseUrl;
const mapPath = resolve(root, "docs/03-delivery/issue-map.json");
const issueMap = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, "utf8")) : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function gh(argv, input) {
  if (
    DRY &&
    !["issue list", "api repos", "label list"].some(
      (p) => argv.slice(0, 2).join(" ").startsWith(p.split(" ")[0]) && argv.join(" ").includes(p.split(" ")[1] ?? ""),
    )
  ) {
    console.log("  [dry-run] gh", argv.join(" "));
    return "";
  }
  return execFileSync("gh", argv, { encoding: "utf8", input, maxBuffer: 50 * 1024 * 1024 });
}

const EPICS = {
  E01: "Authentication & RBAC",
  E02: "Monitoring Project & Members",
  E03: "Threads Integration",
  E04: "Listening Queries",
  E05: "Collector & Sync Jobs",
  E06: "Content Intelligence",
  E07: "Overview Dashboard",
  E08: "Mentions Explorer & Detail",
  E09: "System Status & Observability",
  E10: "Settings",
  E11: "Analyst Workflow (P1)",
  E12: "Export (P1)",
  E13: "Engineering Foundation & Delivery",
};

function labelsFor(t) {
  const l = [
    `type: ${t.type}`,
    `role: ${t.role}`,
    `priority: ${t.priority}`,
    `epic: ${t.epic}`,
    `estimate: ${t.estimate}`,
    ...t.area.map((a) => `area: ${a}`),
  ];
  if (t.inputs?.length) l.push("needs: owner-input");
  return l;
}

const docUrl = (p) => `${BASE}${p}`;
const codeUrl = (p) => `${BASE}${p.replace(/\/$/, "")}`;
const li = (arr) => arr.map((x) => `- ${x}`).join("\n");
const depRef = (id) => (issueMap[id] ? `#${issueMap[id].number} (${id})` : id);

function body(t) {
  const m = backlog.milestones.find((x) => x.id === t.milestone);
  const inputs = (t.inputs || []).map((id) => backlog.openInputs.find((i) => i.id === id)).filter(Boolean);
  return `> **${t.id}** · ${t.type} · ${t.role} · ${t.priority} · estimate **${t.estimate}** · epic **${t.epic} ${EPICS[t.epic]}** · milestone **${t.milestone}** (due ${m?.due})

## Context
${t.summary}

## Docs (read first)
${li(t.docs.map((d) => `[${d}](${docUrl(d)})`))}

## Code location
${li(t.code.map((c) => `[\`${c}\`](${codeUrl(c)})`))}

## Scope
${li(t.scope.map((s) => `[ ] ${s}`))}

## Acceptance criteria
${li(t.acceptance.map((a) => `[ ] ${a}`))}

## Traceability
- Stories: ${t.stories.map((s) => `[${s}](${docUrl("docs/01-product/03-user-stories.md")})`).join(", ") || "—"}
- Requirements: ${t.requirements.map((r) => `[${r}](${docUrl(r.startsWith("NFR") ? "docs/01-product/05-non-functional-requirements.md" : "docs/01-product/04-functional-requirements.md")})`).join(", ") || "—"}
- QC verification: ${t.qc.length ? t.qc.map((q) => `\`${q}\``).join(", ") : "—"} — see [docs/04-qa/test-cases](${docUrl("docs/04-qa/test-cases/")})
- Depends on: ${t.depends_on.length ? t.depends_on.map(depRef).join(", ") : "—"}
${inputs.length ? `\n## ⚠️ Owner input required\n${li(inputs.map((i) => `**${i.id}** (needed by ${i.needed_by}): ${i.item}`))}\n` : ""}
## Definition of Done
See [docs/03-delivery/05-definition-of-ready-done.md](${docUrl("docs/03-delivery/05-definition-of-ready-done.md")}). PR must reference this issue (\`Closes #<n>\`), update docs when behaviour changes, and notify the linked QC task.

<sub>Source of truth: [docs/03-delivery/backlog.json](${docUrl("docs/03-delivery/backlog.json")}) · WBS: [docs/03-delivery/02-work-breakdown.md](${docUrl("docs/03-delivery/02-work-breakdown.md")})</sub>`;
}

// 1) Labels
console.log("Syncing labels…");
const labelYaml = readFileSync(resolve(root, ".github/labels.yml"), "utf8");
const labelDefs = [
  ...labelYaml.matchAll(/name:\s*"([^"]+)",\s*color:\s*"([0-9A-Fa-f]{6})",\s*description:\s*"([^"]*)"/g),
].map((m) => ({ name: m[1], color: m[2], description: m[3] }));
for (const l of labelDefs) {
  if (!DRY) gh(["label", "create", l.name, "-R", REPO, "--color", l.color, "--description", l.description, "--force"]);
}
console.log(`  ${labelDefs.length} labels ensured.`);

// 2) Milestones
console.log("Syncing milestones…");
const existingMs = DRY ? [] : JSON.parse(gh(["api", `repos/${REPO}/milestones?state=all&per_page=100`]));
const msNumber = {};
for (const m of backlog.milestones) {
  const found = existingMs.find(
    (x) =>
      x.title === m.title ||
      x.title.startsWith(`${m.id} `) ||
      x.title.startsWith(`${m.id}·`) ||
      x.title.startsWith(`${m.id} ·`),
  );
  const due = `${m.due}T23:59:59Z`;
  if (found) {
    if (!DRY)
      gh([
        "api",
        "-X",
        "PATCH",
        `repos/${REPO}/milestones/${found.number}`,
        "-f",
        `title=${m.title}`,
        "-f",
        `description=${m.description}`,
        "-f",
        `due_on=${due}`,
      ]);
    msNumber[m.id] = found.number;
  } else if (!DRY) {
    const created = JSON.parse(
      gh([
        "api",
        "-X",
        "POST",
        `repos/${REPO}/milestones`,
        "-f",
        `title=${m.title}`,
        "-f",
        `description=${m.description}`,
        "-f",
        `due_on=${due}`,
      ]),
    );
    msNumber[m.id] = created.number;
  }
}
console.log(`  ${backlog.milestones.length} milestones ensured.`);

// 3) Issues — pass 1: create/update
console.log("Listing existing issues…");
const existing = DRY
  ? []
  : JSON.parse(gh(["issue", "list", "-R", REPO, "--state", "all", "--limit", "1000", "--json", "number,title,url"]));
const byTaskId = {};
for (const i of existing) {
  const m = i.title.match(/^\[(T-\d{3})\]/);
  if (m) byTaskId[m[1]] = i;
}
const tasks = only.length ? backlog.tasks.filter((t) => only.includes(t.id)) : backlog.tasks;

for (const t of tasks) {
  const title = `[${t.id}] ${t.title}`;
  const labels = labelsFor(t);
  const ex = byTaskId[t.id];
  if (ex) {
    console.log(`  update #${ex.number} ${title}`);
    if (!DRY)
      gh(
        [
          "issue",
          "edit",
          String(ex.number),
          "-R",
          REPO,
          "--title",
          title,
          "--body-file",
          "-",
          "--milestone",
          backlog.milestones.find((m) => m.id === t.milestone).title,
          "--add-label",
          labels.join(","),
        ],
        body(t),
      );
    issueMap[t.id] = { number: ex.number, url: ex.url, title };
  } else {
    console.log(`  create ${title}`);
    if (!DRY) {
      const url = gh(
        [
          "issue",
          "create",
          "-R",
          REPO,
          "--title",
          title,
          "--body-file",
          "-",
          "--milestone",
          backlog.milestones.find((m) => m.id === t.milestone).title,
          "--label",
          labels.join(","),
        ],
        body(t),
      ).trim();
      const number = Number(url.split("/").pop());
      issueMap[t.id] = { number, url, title };
      byTaskId[t.id] = { number, url, title };
    }
  }
  if (!DRY) writeFileSync(mapPath, JSON.stringify(issueMap, null, 2) + "\n");
  await sleep(DRY ? 0 : 1300);
}

// 4) Pass 2: rewrite bodies so "Depends on" shows issue numbers
console.log("Linking dependencies…");
for (const t of tasks) {
  if (!t.depends_on.length || !issueMap[t.id]) continue;
  if (!DRY) gh(["issue", "edit", String(issueMap[t.id].number), "-R", REPO, "--body-file", "-"], body(t));
  await sleep(DRY ? 0 : 1300);
}
console.log(`Done. ${Object.keys(issueMap).length} issues mapped → docs/03-delivery/issue-map.json`);
