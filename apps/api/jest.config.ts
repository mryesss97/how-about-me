import type { Config } from "jest";

const common: Partial<Config> = {
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json", isolatedModules: true }] },
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
