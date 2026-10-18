// NFR-002: mentions list p95 < 1.0 s (limit 25) at 20 VU; NFR-007: `q` search p95 < 1.5 s.
import http from "k6/http";
import { check } from "k6";
import { API, TZ, pick, qs, scenarios, think } from "./lib/config.js";
import { authParams, getToken } from "./lib/auth.js";
import { range } from "./lib/ranges.js";
import { summarize } from "./lib/summary.js";

const SORTS = ["newest", "oldest", "safety_desc", "relevance_desc"];
const FILTERS = [{ sentiment: "negative" }, { intent: "complaint" }, { topic: "ticket" }];
const QUERIES = __ENV.PERF_Q_TERMS ? __ENV.PERF_Q_TERMS.split(",") : ["ve", "concert", "gia"];

export const options = {
  scenarios: scenarios("mentions"),
  thresholds: {
    "http_req_duration{endpoint:mentions,phase:measure}": ["p(95)<1000"],
    "http_req_duration{endpoint:mentions_q,phase:measure}": ["p(95)<1500"],
    "http_req_failed{phase:measure}": ["rate<0.01"],
    "checks{phase:measure}": ["rate>0.99"],
  },
};

export function setup() {
  return { token: getToken() };
}

export function mentions(data) {
  const rangeName = pick(["7d", "30d"]);
  const params = { ...range(rangeName), timezone: TZ, limit: 25, sort: pick(SORTS) };
  const roll = Math.random();
  let endpoint = "mentions";
  if (roll < 0.2) params.count = "true";
  else if (roll < 0.5) Object.assign(params, pick(FILTERS));
  else if (roll < 0.6) {
    params.q = pick(QUERIES);
    endpoint = "mentions_q";
  }
  const res = http.get(`${API}/mentions?${qs(params)}`, authParams(data.token, endpoint, { range: rangeName }));
  check(res, {
    "mentions 200": (r) => r.status === 200,
    "items <= 25": (r) => r.status === 200 && r.json("items").length <= 25,
  });
  think();
}

export function handleSummary(data) {
  return summarize(data);
}
