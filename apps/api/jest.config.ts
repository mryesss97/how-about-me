import type { Config } from "jest";

const common: Partial<Config> = {
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json", isolatedModules: true }],
    // ESM-only deps (jose) are compiled to CJS so Jest's CJS runtime can require them on every Node 24.x,
    // without --experimental-vm-modules — docs/02-architecture/10-testing-strategy.md §9.
    "^.+\\.js$": ["ts-jest", { tsconfig: { allowJs: true, target: "es2022" }, isolatedModules: true }],
  },
  transformIgnorePatterns: ["/node_modules/(?!(\\.pnpm/)?jose[@/])"],
  moduleFileExtensions: ["ts", "js", "json"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  rootDir: ".",
};

const config: Config = {
  projects: [
    { ...common, displayName: "unit", testMatch: ["<rootDir>/src/**/*.spec.ts"], testEnvironment: "node" },
    {
      ...common,
      displayName: "integration",
      testMatch: ["<rootDir>/test/integration/**/*.int-spec.ts"],
      testEnvironment: "node",
      globalSetup: "<rootDir>/test/global-setup.ts",
      setupFilesAfterEnv: ["<rootDir>/test/setup-after-env.ts"],
    },
  ],
  collectCoverageFrom: ["src/modules/**/*.service.ts", "src/common/**/*.ts", "!src/**/*.spec.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
};
export default config;
