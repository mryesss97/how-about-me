// Token: PERF_TOKEN, or Supabase password grant (anon key + perf user via env). Never printed.
import http from "k6/http";

export function getToken() {
  if (__ENV.PERF_TOKEN) return __ENV.PERF_TOKEN;
  const url = __ENV.PERF_SUPABASE_URL;
  const anon = __ENV.PERF_SUPABASE_ANON_KEY;
  const email = __ENV.PERF_USER_EMAIL;
  const password = __ENV.PERF_USER_PASSWORD;
  if (!url || !anon || !email || !password) {
    throw new Error(
      "Set PERF_TOKEN or PERF_SUPABASE_URL + PERF_SUPABASE_ANON_KEY + PERF_USER_EMAIL + PERF_USER_PASSWORD",
    );
  }
  const res = http.post(
    `${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    {
      headers: { apikey: anon, "Content-Type": "application/json" },
      tags: { endpoint: "auth" },
    },
  );
  if (res.status !== 200) throw new Error(`Supabase login failed: HTTP ${res.status}`);
  return res.json("access_token");
}

export function authParams(token, endpoint, extraTags) {
  return { headers: { Authorization: `Bearer ${token}` }, tags: Object.assign({ endpoint }, extraTags || {}) };
}
