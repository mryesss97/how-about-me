import base from "./base.js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/** Next.js app: React hooks rules, Next core-web-vitals, browser globals. */
export default [
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
];
