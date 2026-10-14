/** Landing page copy (#262, #267). English for MVP (docs 03 §8). */
export const landingCopy = {
  /** Two headline lines; `headlineAccent` is tinted brand on screen (#267). */
  headlineLines: ["See how Threads", "feels about you."] as const,
  headlineAccent: "feels",
  tagline: "Listen. Understand.",
  explore: "Explore dashboard",
  /** Eyebrow pill (#267); "Live" only shows once a sync has happened (open question 2). */
  eyebrow: { live: "Live", source: "Threads", range: "Last 30 days" },
  legend: "Orb size = mentions · colour = dominant sentiment · last 30 days",
  balloonsLabel: "Sentiment of landing terms, last 30 days",
  statsLabel: "Last 30 days",
  stats: {
    mentions: "Mentions",
    positive: "Positive",
    negative: "Negative",
    lastUpdated: "Updated",
  },
  neverSynced: "Not synced",
  emptyAdmin: "Add landing phrases in Settings",
  emptyOther: "No landing phrases configured yet.",
  noMentions: "no mentions",
};
