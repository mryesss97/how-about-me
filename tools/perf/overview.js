// NFR-001: overview p95 < 1.5 s at 20 VU (24h/7d, default filters). Also measures the full dashboard burst.
import http from "k6/http";
import { check } from "k6";
import { API, TZ, pick, qs, scenarios, think } from "./lib/config.js";
import { authParams, getToken } from "./lib/auth.js";
import { range } from "./lib/ranges.js";
import { summarize } from "./lib/summary.js";

const DISTRIBUTIONS = ["sentiment", "safety", "intents", "topics", "languages", "query-share"];

export const options = {
  scenarios: scenarios("overview"),
  thresholds: {
    "http_req_duration{endpoint:overview,phase:measure}": ["p(95)<1500"],
    "http_req_duration{endpoint:dashboard_other,phase:measure}": ["p(95)<1500"],
    "http_req_failed{phase:measure}": ["rate<0.01"],
    "checks{phase:measure}": ["rate>0.99"],
  },
};

export function setup() {
  return { token: getToken() };
}

export function overview(data) {
  const rangeName = pick(["24h", "7d"]);
  const query = qs({ ...range(rangeName), timezone: TZ, compare: "true" });
  const tags = { range: rangeName };
  const reqs = [["GET", `${API}/analytics/overview?${query}`, null, authParams(data.token, "overview", tags)]];
  reqs.push([
    "GET",
    `${API}/analytics/mentions-timeseries?${query}`,
    null,
    authParams(data.token, "dashboard_other", tags),
  ]);
  for (const d of DISTRIBUTIONS) {
    reqs.push(["GET", `${API}/analytics/${d}?${query}`, null, authParams(data.token, "dashboard_other", tags)]);
  }
  const res = http.batch(reqs);
  check(res[0], {
    "overview 200": (r) => r.status === 200,
    "overview has kpis": (r) => r.status === 200 && r.json("kpis.mentionCount.value") !== undefined,
  });
  check(res.slice(1), { "dashboard calls 200": (rs) => rs.every((r) => r.status === 200) });
  think();
}

export function handleSummary(data) {
  return summarize(data);
}
