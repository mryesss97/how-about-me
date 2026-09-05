import next from "@how-about-me/eslint-config/next";
export default [
  ...next,
  // Vendored Untitled UI components keep upstream style; lint our code only.
  {
    ignores: [
      ".next/**",
      "src/components/**",
      "src/hooks/**",
      "src/utils/**",
      "src/providers/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
];
