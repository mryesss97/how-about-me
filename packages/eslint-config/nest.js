import base from "./base.js";

/** NestJS: decorators-heavy code, allow classes with only decorators, console allowed in CLI scripts. */
export default [
  ...base,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // NestJS DI relies on emitDecoratorMetadata: injected classes must stay runtime imports, so `import type` enforcement is off here.
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
  { files: ["src/cli/**/*.ts", "prisma/**/*.ts", "test/**/*.ts"], rules: { "no-console": "off" } },
];
