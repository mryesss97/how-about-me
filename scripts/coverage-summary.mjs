#!/usr/bin/env node
// Writes a coverage table from every */coverage/coverage-summary.json to $GITHUB_STEP_SUMMARY (or stdout).
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaces = ["apps/api", "apps/web", "packages/contracts", "packages/taxonomy"];
const rows = ["| Workspace | Lines | Statements | Branches | Functions |", "| --- | --- | --- | --- | --- |"];
for (const ws of workspaces) {
  const file = resolve(root, ws, "coverage/coverage-summary.json");
  if (!existsSync(file)) continue;
  const t = JSON.parse(readFileSync(file, "utf8")).total;
  rows.push(`| ${ws} | ${t.lines.pct}% | ${t.statements.pct}% | ${t.branches.pct}% | ${t.functions.pct}% |`);
}
const md = `## Coverage\n\n${rows.length > 2 ? rows.join("\n") : "_No coverage reports found._"}\n`;
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
else process.stdout.write(md);
