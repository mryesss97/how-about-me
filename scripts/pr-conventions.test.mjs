// Tests for scripts/lib/pr-conventions.mjs, the rules pr:create runs
// (docs/06-engineering/04-git-workflow.md §1–§4). Ported from
// live-stream-admin; this repo has no `[RELEASE] ` title prefix.
//
//   node --test scripts/pr-conventions.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { conventionProblems, TITLE_MAX } from "./lib/pr-conventions.mjs";

const GOOD = {
  branch: "feature/71-collector-window-calculator",
  title: "feat(collector): compute the search window with overlap",
  base: "develop",
};

test("a feature PR into develop with a conventional title passes", () => {
  assert.deepEqual(conventionProblems(GOOD), []);
});

test("every branch type of the git workflow passes", () => {
  const ok = (branch, base = "develop") => assert.deepEqual(conventionProblems({ ...GOOD, branch, base }), [], branch);
  ok("fix/143-growth-new-state");
  ok("refactor/9-split-collector");
  ok("perf/9-faster-rollup");
  ok("test/9-mentions-e2e");
  ok("spike/12-threads-poc");
  ok("chore/agent-workflow");
  ok("chore/135-agent-workflow");
  ok("docs/7-api-contract");
  ok("release/v0.1.0", "main");
  ok("hotfix/v0.1.1", "main");
});

test("a branch without an issue, a deprecated type or camelCase fails", () => {
  for (const branch of ["feature/no-issue", "feat/71-x", "bugfix/71-x", "feature/71-streamList", "release/sprint-1"]) {
    assert.match(conventionProblems({ ...GOOD, branch })[0], /sai quy ước/, branch);
  }
});

test("a title with an unknown type, a trailing period or no subject fails", () => {
  for (const title of ["update: add list", "feat: add list.", "feat:add list", "feat: ", "Feat: add list"]) {
    assert.equal(conventionProblems({ ...GOOD, title }).length, 1, title);
  }
});

test("a title is capped at the commitlint header length", () => {
  const title = `feat: ${"a".repeat(TITLE_MAX)}`;
  assert.match(conventionProblems({ ...GOOD, title })[0], /sai format/);
  assert.deepEqual(conventionProblems({ ...GOOD, title: title.slice(0, TITLE_MAX) }), []);
});

test("a scope and a breaking-change mark pass", () => {
  assert.deepEqual(conventionProblems({ ...GOOD, title: "feat(api)!: drop the v0 export" }), []);
});

test("a missing title or base fails instead of letting gh prompt", () => {
  assert.match(conventionProblems({ ...GOOD, title: undefined }).join("\n"), /Thiếu --title/);
  assert.match(conventionProblems({ ...GOOD, base: undefined }).join("\n"), /Thiếu --base/);
});

test("a feature PR into main fails", () => {
  assert.match(conventionProblems({ ...GOOD, base: "main" }).join("\n"), /phải PR vào develop/);
});

test("a release PR targets main only", () => {
  const release = { branch: "release/v0.1.0", title: "chore(release): v0.1.0", base: "main" };
  assert.deepEqual(conventionProblems(release), []);
  assert.match(conventionProblems({ ...release, base: "develop" }).join("\n"), /release\/\* phải PR vào main/);
});

test("a hotfix PR may target main or develop", () => {
  const hotfix = { branch: "hotfix/v0.1.1", title: "fix(web): keep the filter after reload" };
  assert.deepEqual(conventionProblems({ ...hotfix, base: "main" }), []);
  assert.deepEqual(conventionProblems({ ...hotfix, base: "develop" }), []);
  assert.equal(conventionProblems({ ...hotfix, base: "release/v0.1.0" }).length, 1);
});

test("bot branches skip every rule", () => {
  assert.deepEqual(conventionProblems({ branch: "dependabot/npm_and_yarn/next-16", title: "Bump" }), []);
  assert.deepEqual(conventionProblems({ branch: "renovate/turbo", title: "Bump" }), []);
});
