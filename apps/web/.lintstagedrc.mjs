// Vendored Untitled UI folders are excluded by eslint.config.mjs ignores and .prettierignore.
export default {
  "*.{ts,tsx}": ["pnpm exec eslint --fix --max-warnings=0 --no-warn-ignored", "pnpm exec prettier --write"],
  "*.{json,md,yml,yaml,mjs,cjs,css}": "pnpm exec prettier --write --ignore-unknown",
};
