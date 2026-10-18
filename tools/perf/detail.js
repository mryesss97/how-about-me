// NFR-003: mention detail p95 < 700 ms at 20 VU over a pool of ~200 ids taken from the list.
import http from "k6/http";
import { check } from "k6";
import { API, TZ, pick, qs, scenarios, think } from "./lib/config.js";
import { authParams, getToken } from "./lib/auth.js";
import { range } from "./lib/ranges.js";
import { summarize } from "./lib/summary.js";

export const options = {
  scenarios: scenarios("detail"),
  thresholds: {
    "http_req_duration{endpoint:detail,phase:measure}": ["p(95)<700"],
    "http_req_failed{phase:measure}": ["rate<0.01"],
    "checks{phase:measure}": ["rate>0.99"],
  },
};

export function setup() {
  const token = getToken();
  const ids = [];
  let cursor;
  for (let page = 0; page < 2 && ids.length < 200; page++) {
    const query = qs({ ...range("30d"), timezone: TZ, limit: 100, cursor });
    const res = http.get(`${API}/mentions?${query}`, authParams(token, "setup"));
    if (res.status !== 200) throw new Error(`Cannot load mention ids: HTTP ${res.status}`);
    for (const item of res.json("items")) ids.push(item.id);
    cursor = res.json("nextCursor");
    if (!cursor) break;
  }
  if (ids.length === 0) throw new Error("No mentions in the last 30 days — run perf:seed first");
  return { token, ids };
}

export function detail(data) {
  const id = pick(data.ids);
  const res = http.get(`${API}/mentions/${id}`, authParams(data.token, "detail"));
  check(res, {
    "detail 200": (r) => r.status === 200,
    "detail id matches": (r) => r.status === 200 && r.json("id") === id,
  });
  think();
}

export function handleSummary(data) {
  return summarize(data);
}
