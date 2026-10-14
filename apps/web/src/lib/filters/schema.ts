import { ANALYSIS_STATUSES, type AnalysisStatus, type MENTION_SORTS } from "@how-about-me/contracts";
import {
  INTENT_LABELS,
  LANGUAGE_CODES,
  RELEVANCE_LABELS,
  SAFETY_LEVELS,
  SENTIMENT_LABELS,
  TOPIC_LABELS,
  type IntentLabel,
  type LanguageCode,
  type RelevanceLabel,
  type SafetyLevel,
  type SentimentLabel,
  type TopicLabel,
} from "@how-about-me/taxonomy";

/** Time presets — FR-131. Default 7d (UX §2.1). */
export const PRESETS = ["1h", "24h", "7d", "30d", "custom"] as const;
export type Preset = (typeof PRESETS)[number];
export const DEFAULT_PRESET: Preset = "7d";
export type MentionSort = (typeof MENTION_SORTS)[number];

/** BR-016: default relevance is `relevant`; `irrelevant` only when chosen explicitly. */
export const DEFAULT_RELEVANCE: RelevanceLabel[] = ["relevant"];
/** Mirrors `csvArray` max in contracts. */
export const MAX_ARRAY_ITEMS = 50;

/** Multi-select enum filters (BR-017: sentiment and safety are separate filters). */
export const ENUM_FILTERS = {
  relevance: RELEVANCE_LABELS,
  sentiment: SENTIMENT_LABELS,
  safety: SAFETY_LEVELS,
  intent: INTENT_LABELS,
  topic: TOPIC_LABELS,
  language: LANGUAGE_CODES,
  analysisStatus: ANALYSIS_STATUSES,
} as const;
export type EnumFilterKey = keyof typeof ENUM_FILTERS;
/** `phrase` (FR-148) is a free-text array: chip only, no picker in the filter bar. */
export type ArrayFilterKey = EnumFilterKey | "queryIds" | "phrase";

/** FE filter state as kept in the URL. `tz` maps to API `timezone`; `preset` never reaches the API. */
export interface Filters {
  preset: Preset;
  from: Date | null;
  to: Date | null;
  tz: string;
  queryIds: string[];
  relevance: RelevanceLabel[];
  sentiment: SentimentLabel[];
  safety: SafetyLevel[];
  intent: IntentLabel[];
  topic: TopicLabel[];
  language: LanguageCode[];
  analysisStatus: AnalysisStatus[];
  /** Key phrases, normalised with BR-041. */
  phrase: string[];
  q: string | null;
  sort: MentionSort;
  compare: boolean;
}

export function defaultFilters(tz: string): Filters {
  return {
    preset: DEFAULT_PRESET,
    from: null,
    to: null,
    tz,
    queryIds: [],
    relevance: [...DEFAULT_RELEVANCE],
    sentiment: [],
    safety: [],
    intent: [],
    topic: [],
    language: [],
    analysisStatus: [],
    phrase: [],
    q: null,
    sort: "newest",
    compare: false,
  };
}
