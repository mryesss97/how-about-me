/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "chore", "refactor", "test", "perf", "ci", "build", "revert", "style"],
    ],
    "scope-enum": [
      1,
      "always",
      [
        "web",
        "api",
        "contracts",
        "taxonomy",
        "collector",
        "analysis",
        "analytics",
        "mentions",
        "queries",
        "auth",
        "projects",
        "integrations",
        "status",
        "infra",
        "docs",
        "deps",
        "release",
      ],
    ],
    "subject-case": [0],
    "header-max-length": [2, "always", 120],
    "body-max-line-length": [0],
  },
};
