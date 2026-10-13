import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseUrl ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  // Start the web dev server only when targeting the local stack. The API (PROVIDERS_MODE=fake) is started by the developer via root `pnpm dev`.
  webServer: externalBaseUrl
    ? undefined
    : { command: "pnpm dev", url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/.*\.auth\.spec\.ts/, /auth\.setup\.ts/],
    },
    {
      name: "chromium-auth",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
      testMatch: /.*\.auth\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
});
