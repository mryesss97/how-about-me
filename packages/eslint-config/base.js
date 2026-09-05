import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import globals from "globals";

/** Shared base: TS strict-ish rules, prettier compatibility, package-boundary guard. */
export default tseslint.config(
  { ignores: ["**/dist/**", "**/.next/**", "**/coverage/**", "**/node_modules/**", "**/*.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.es2023 } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-non-null-assertion": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@how-about-me/api", "@how-about-me/api/*", "apps/api/*"],
              message: "Web must not import from the API app. Use @how-about-me/contracts.",
            },
            {
              group: ["@how-about-me/web", "@how-about-me/web/*", "apps/web/*"],
              message: "API must not import from the web app.",
            },
          ],
        },
      ],
    },
  },
  prettier,
);
