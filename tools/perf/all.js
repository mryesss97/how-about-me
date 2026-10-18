// Mixed acceptance run: PERF_VUS total split across overview / mentions / detail (NFR-001…003, NFR-007).
import { DURATION, VUS, WARMUP } from "./lib/config.js";
import { overview } from "./overview.js";
import { mentions } from "./mentions.js";
import { detail, setup as detailSetup } from "./detail.js";
import { summarize } from "./lib/summary.js";

export { overview, mentions, detail };

const share = { overview: Math.max(1, Math.round(VUS * 0.4)), mentions: Math.max(1, Math.round(VUS * 0.4)) };
share.detail = Math.max(1, VUS - share.overview - share.mentions);

function scenario(exec, startTime, duration, phase) {
  return { executor: "constant-vus", exec, vus: share[exec], duration, startTime, tags: { phase } };
}

export const options = {
  scenarios: {
    overview_warmup: scenario("overview", "0s", WARMUP, "warmup"),
    mentions_warmup: scenario("mentions", "0s", WARMUP, "warmup"),
    detail_warmup: scenario("detail", "0s", WARMUP, "warmup"),
    overview_measure: scenario("overview", WARMUP, DURATION, "measure"),
    mentions_measure: scenario("mentions", WARMUP, DURATION, "measure"),
    detail_measure: scenario("detail", WARMUP, DURATION, "measure"),
  },
  thresholds: {
    "http_req_duration{endpoint:overview,phase:measure}": ["p(95)<1500"],
    "http_req_duration{endpoint:dashboard_other,phase:measure}": ["p(95)<1500"],
    "http_req_duration{endpoint:mentions,phase:measure}": ["p(95)<1000"],
    "http_req_duration{endpoint:mentions_q,phase:measure}": ["p(95)<1500"],
    "http_req_duration{endpoint:detail,phase:measure}": ["p(95)<700"],
    "http_req_failed{phase:measure}": ["rate<0.01"],
    "checks{phase:measure}": ["rate>0.99"],
  },
};

// detail's setup also returns the token used by the other scenarios.
export const setup = detailSetup;

export function handleSummary(data) {
  return summarize(data);
}
