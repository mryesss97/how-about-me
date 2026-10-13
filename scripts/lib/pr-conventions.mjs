// Branch name, PR title and target branch rules of
// docs/06-engineering/04-git-workflow.md §1–§4. `pnpm pr:create` runs them
// before `gh pr create`, because GitHub Actions does not fire on PR events here.

/** §1: `<type>/<issue>-<kebab-slug>`; chore/docs may drop the issue. */
export const BRANCH_RE =
  /^((feature|fix|refactor|perf|test|spike)\/\d+-[a-z0-9]+(-[a-z0-9]+)*|(chore|docs)\/(\d+-)?[a-z0-9]+(-[a-z0-9]+)*|(release|hotfix)\/v\d+\.\d+\.\d+)$/;
/** §4 and commitlint.config.cjs: the squash commit is the PR title. */
export const TITLE_RE =
  /^(feat|fix|docs|chore|refactor|test|perf|ci|build|revert|style)(\([a-z0-9-]+\))?!?: [^\s.](.*[^.])?$/;
/** commitlint `header-max-length`. */
export const TITLE_MAX = 120;
const BOTS = /^(dependabot|renovate)\//;

/** Every rule the PR breaks, as one line each. An empty list means it passes. */
export function conventionProblems({ branch, title, base }) {
  if (BOTS.test(branch)) return [];
  const problems = [];
  if (!BRANCH_RE.test(branch)) {
    problems.push(
      `Branch '${branch}' sai quy ước. Dùng <type>/<issue>-<kebab-slug>, vd: feature/71-collector-window-calculator (git workflow §1).`,
    );
  }
  if (!title) {
    problems.push('Thiếu --title "<subject>".');
  } else if (!TITLE_RE.test(title) || title.length > TITLE_MAX) {
    problems.push(
      `Title '${title}' sai format. Dùng <type>(<scope>): <subject>, ≤${TITLE_MAX} ký tự, không dấu chấm cuối (git workflow §4).`,
    );
  }
  if (!base) {
    problems.push("Thiếu --base <branch>. PR vào develop: --base develop.");
    return problems;
  }
  if (branch.startsWith("release/")) {
    if (base !== "main") problems.push(`release/* phải PR vào main, không phải '${base}'.`);
  } else if (branch.startsWith("hotfix/")) {
    if (base !== "main" && base !== "develop")
      problems.push(`hotfix/* PR vào main (rồi back-merge develop), không phải '${base}'.`);
  } else if (base !== "develop") {
    problems.push(`Nhánh '${branch}' phải PR vào develop, không phải '${base}'.`);
  }
  return problems;
}
