#!/usr/bin/env node
// Renders docs/03-delivery/02-work-breakdown.md from docs/03-delivery/backlog.json (source of truth).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const backlog = JSON.parse(readFileSync(resolve(root, "docs/03-delivery/backlog.json"), "utf8"));
const mapPath = resolve(root, "docs/03-delivery/issue-map.json");
const issueMap = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, "utf8")) : {};

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
const rel = (p) => `../../${p}`.replace("../../docs/", "../"); // links relative to docs/03-delivery/
const issueLink = (id) => (issueMap[id] ? `[#${issueMap[id].number}](${issueMap[id].url})` : "—");
const docLinks = (docs) => docs.map((d) => `[${d.split("/").pop().split("#")[0]}](${rel(d)})`).join("<br>");

let out = `# 02 · Work Breakdown Structure (WBS) → GitHub Issues

> **Generated** from [backlog.json](backlog.json) by \`pnpm backlog:render\`. Edit the JSON, not this file.
> Each task \`T-###\` is one GitHub issue (\`pnpm issues:sync\`). Estimates: S ≤ 1 d · M ≤ 3 d · L ≤ 5 d.

## Summary

| Milestone | Tasks | Engineer | QC | S / M / L |
|---|---|---|---|---|
`;
for (const m of backlog.milestones) {
  const ts = backlog.tasks.filter((t) => t.milestone === m.id);
  const c = (k, v) => ts.filter((t) => t[k] === v).length;
  out += `| **${m.id}** ${m.title.replace(/^M\d · /, "")} (due ${m.due}) | ${ts.length} | ${c("role", "engineer")} | ${c("role", "qc")} | ${c("estimate", "S")} / ${c("estimate", "M")} / ${c("estimate", "L")} |\n`;
}
out += `| **Total** | ${backlog.tasks.length} | ${backlog.tasks.filter((t) => t.role === "engineer").length} | ${backlog.tasks.filter((t) => t.role === "qc").length} | |\n\n`;

out += `## Open inputs (Product Owner)

| ID | Needed by | Item | Blocks |
|---|---|---|---|
`;
for (const i of backlog.openInputs) out += `| ${i.id} | ${i.needed_by} | ${i.item} | ${i.blocks.join(", ") || "—"} |\n`;

for (const m of backlog.milestones) {
  const ts = backlog.tasks.filter((t) => t.milestone === m.id);
  out += `\n## ${m.title} — due ${m.due}\n\n${m.description}\n\n| ID | Issue | Task | Type | Role | Area | Pri | Est | Epic | Depends on | Stories / FRs | Docs |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const t of ts) {
    out += `| ${t.id} | ${issueLink(t.id)} | ${t.title} | ${t.type} | ${t.role} | ${t.area.join(", ")} | ${t.priority} | ${t.estimate} | ${t.epic} | ${t.depends_on.join(", ") || "—"} | ${[...t.stories, ...t.requirements].join(", ")} | ${docLinks(t.docs)} |\n`;
  }
}

out += `\n## Epic index\n\n| Epic | Name | Tasks |\n|---|---|---|\n`;
for (const [e, name] of Object.entries(EPICS)) {
  const ts = backlog.tasks.filter((t) => t.epic === e).map((t) => t.id);
  out += `| ${e} | ${name} | ${ts.join(", ")} |\n`;
}

out += `\n## Dependency graph (critical chain, simplified)

\`\`\`mermaid
flowchart LR
  T007[T-007 Prisma baseline] --> T051[T-051 Ingestion]
  T021[T-021 Threads spike] --> T039[T-039 Threads provider]
  T039 --> T052[T-052 Collector run loop]
  T048[T-048 Scheduler] --> T052
  T051 --> T052
  T052 --> T062[T-062 Staging soak · M2 gate]
  T070[T-070 Analysis runs] --> T074[T-074 Pipeline]
  T072[T-072 Classifier] --> T074
  T074 --> T081[T-081 Prompt freeze · M3 gate]
  T074 --> T090[T-090 Analytics base]
  T090 --> T091[T-091 Overview API] --> T099[T-099 KPI cards]
  T090 --> T095[T-095 Mentions API] --> T103[T-103 Mentions UI]
  T094[T-094 Reconciliation tests] --> T112[T-112 QC reconciliation · M4 gate]
  T112 --> T127[T-127 Regression] --> T129[T-129 Release v0.1.0]
\`\`\`
`;
writeFileSync(resolve(root, "docs/03-delivery/02-work-breakdown.md"), out);
console.log(`Rendered WBS with ${backlog.tasks.length} tasks.`);
