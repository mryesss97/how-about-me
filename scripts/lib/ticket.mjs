// A ticket is a GitHub issue (`12`, `#12`) or a backlog task id (`T-049`).
//
// Ported from live-stream-admin. That repo also takes Jira keys; this one
// tracks work as GitHub issues titled `[T-###] …` (docs/03-delivery). A task id
// resolves to its issue number through docs/03-delivery/issue-map.json, which
// `pnpm issues:sync` writes.
import { readFileSync } from "node:fs";

const GITHUB = /^#?(\d+)$/;
const TASK = /^T-\d{3,}$/i;

/** `Closes #12` closes a GitHub issue; `Refs: #12` only links it. */
export const CLOSING = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;

const ISSUE_MAP = new URL("../../docs/03-delivery/issue-map.json", import.meta.url);

function readIssueMap() {
  try {
    return JSON.parse(readFileSync(ISSUE_MAP, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Parses what the user typed. `ref` is the form the ledger and the PR body
 * use (`#12`). `slug` is the form a branch or a run file uses (`12`).
 * `issueMap` is injectable for tests.
 */
export function parseTicket(text, issueMap = readIssueMap()) {
  const value = String(text ?? "").trim();
  const github = value.match(GITHUB);
  let number = github?.[1];
  let task;
  if (!number && TASK.test(value)) {
    task = value.toUpperCase();
    number = issueMap[task]?.number?.toString();
    if (!number) {
      throw new Error(
        `${task} chưa có trong docs/03-delivery/issue-map.json. Chạy pnpm issues:sync, hoặc dùng số issue.`,
      );
    }
  }
  if (!number) {
    throw new Error(`"${value}" không phải ticket. Dùng số issue GitHub (12) hoặc task id (T-049).`);
  }
  return { kind: "github", id: number, ref: `#${number}`, slug: number, task };
}

/**
 * The GitHub issues of this repo a PR body closes, as numbers in order, no
 * repeats. `owner/repo#N` and `Refs: #N` are left out: GitHub only
 * auto-closes on merge into the default branch (`main`), so `issue:finish`
 * closes these itself for PRs into `develop`.
 */
export function closingIssues(body) {
  const numbers = [...String(body ?? "").matchAll(CLOSING)].map((match) => match[1]);
  return [...new Set(numbers)];
}

/** The tickets a PR body closes, as `#12`, no repeats. */
export function ticketsInBody(body) {
  return closingIssues(body).map((number) => `#${number}`);
}
