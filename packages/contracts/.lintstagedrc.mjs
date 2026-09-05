// Closest lint-staged config wins: commands run with cwd = this package, so local ESLint 9 flat config applies.
export default {
  "*.ts": ["pnpm exec eslint --fix --max-warnings=0 --no-warn-ignored", "pnpm exec prettier --write"],
  "*.{json,md,yml,yaml,mjs,cjs}": "pnpm exec prettier --write --ignore-unknown",
};
