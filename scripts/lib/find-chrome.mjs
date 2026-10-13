// Finds a Chrome for `pnpm issue:shot`. Ported from live-stream-admin, which
// drives Chrome with puppeteer-core. This repo has no puppeteer: it drives the
// browser with the Playwright that apps/web already installs for its e2e
// suite (`@playwright/test`), so no new dependency.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const SYSTEM_CHROMES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

/** Playwright lives in apps/web; pnpm does not hoist it to the root. */
export function loadPlaywright() {
  const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
  try {
    return require("@playwright/test");
  } catch {
    throw new Error("Không tìm thấy @playwright/test trong apps/web. Chạy pnpm install.");
  }
}

/**
 * The browser binary, in this order: CHROME_PATH, the Chromium Playwright
 * downloaded (`pnpm --filter @how-about-me/web exec playwright install
 * chromium`), then a system Chrome. `bundled` is Playwright's own path, which
 * may not exist on disk yet.
 */
export function findChrome({ env = process.env, bundled, exists = existsSync } = {}) {
  for (const candidate of [env.CHROME_PATH, bundled, ...SYSTEM_CHROMES]) {
    if (candidate && exists(candidate)) return candidate;
  }
  throw new Error(
    "Không tìm thấy Chrome. Chạy pnpm --filter @how-about-me/web exec playwright install chromium, cài Google Chrome, hoặc set CHROME_PATH=/đường/dẫn/tới/chrome.",
  );
}

function bundledPath(chromium) {
  try {
    return chromium.executablePath();
  } catch {
    return undefined;
  }
}

/**
 * Launches headless Chrome and retries once: Chrome sometimes dies during the
 * handshake ("Target closed") when the machine is busy.
 */
export async function launchChrome(chromium, options = {}) {
  const config = {
    executablePath: findChrome({ bundled: bundledPath(chromium) }),
    headless: true,
    ...options,
  };
  try {
    return await chromium.launch(config);
  } catch (error) {
    await new Promise((done) => setTimeout(done, 750));
    try {
      return await chromium.launch(config);
    } catch {
      throw error;
    }
  }
}
