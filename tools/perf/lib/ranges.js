// Ranges end at "now" UTC; perf:seed anchors its 7-day burst at seed time — re-seed if the run is days later.
const HOUR = 3600 * 1000;
const SPANS = { "24h": 24 * HOUR, "7d": 7 * 24 * HOUR, "30d": 30 * 24 * HOUR, "120d": 120 * 24 * HOUR };

export function range(name) {
  const to = new Date();
  const from = new Date(to.getTime() - SPANS[name]);
  return { from: from.toISOString(), to: to.toISOString() };
}
