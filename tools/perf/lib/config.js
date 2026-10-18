import { sleep } from "k6";
// Shared k6 config — reads __ENV, never logs the token (T-120, NFR-001…003).
function required(name) {
  const v = __ENV[name];
  if (!v) throw new Error(`Missing env ${name} (see tools/perf/README.md)`);
  return v;
}

export const BASE_URL = required("PERF_BASE_URL").replace(/\/$/, "");
export const PROJECT_ID = required("PERF_PROJECT_ID");
export const TZ = __ENV.PERF_TZ || "Asia/Ho_Chi_Minh";
export const VUS = Number(__ENV.PERF_VUS || 20);
export const DURATION = __ENV.PERF_DURATION || "5m";
export const WARMUP = __ENV.PERF_WARMUP || "30s";
/** Think time between a user's page loads, seconds (mean; ±50 % jitter). Without it 1 VU fires ~1500 req/s. */
export const THINK_S = Number(__ENV.PERF_THINK_S || 3);
export const API = `${BASE_URL}/api/v1/projects/${PROJECT_ID}`;

/** Warm-up scenario (not thresholded: tagged phase=warmup) followed by the measured scenario. */
export function scenarios(exec) {
  return {
    warmup: { executor: "constant-vus", exec, vus: VUS, duration: WARMUP, tags: { phase: "warmup" } },
    measure: {
      executor: "constant-vus",
      exec,
      vus: VUS,
      duration: DURATION,
      startTime: WARMUP,
      tags: { phase: "measure" },
    },
  };
}

/** A user reading the page before the next one (THINK_S ± 50 %). */
export function think() {
  sleep(THINK_S * (0.5 + Math.random()));
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function qs(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}
