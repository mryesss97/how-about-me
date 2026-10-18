// Short p50/p95/p99/RPS/error table per endpoint tag; no headers or tokens in the output.
export function summarize(data) {
  const lines = ["metric | count | p50 | p95 | p99 | max (ms)"];
  for (const [name, m] of Object.entries(data.metrics)) {
    if (!name.startsWith("http_req_duration{") || !m.values) continue;
    const v = m.values;
    const f = (x) => (x === undefined ? "-" : x.toFixed(0));
    lines.push(`${name} | ${v.count ?? "-"} | ${f(v.med)} | ${f(v["p(95)"])} | ${f(v["p(99)"])} | ${f(v.max)}`);
  }
  const failed = data.metrics.http_req_failed?.values?.rate;
  const rps = data.metrics.http_reqs?.values?.rate;
  lines.push(`http_req_failed rate: ${failed ?? "-"}; http_reqs/s: ${rps?.toFixed(1) ?? "-"}`);
  const out = { stdout: lines.join("\n") + "\n" };
  if (__ENV.PERF_SUMMARY_JSON) out[__ENV.PERF_SUMMARY_JSON] = JSON.stringify(data, null, 2);
  return out;
}
