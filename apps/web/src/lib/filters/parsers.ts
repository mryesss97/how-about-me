import {
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";
import { isValidTimezone, MENTION_SORTS, UuidSchema } from "@how-about-me/contracts";
import { normalizePhrase } from "@how-about-me/taxonomy";
import { env } from "@/lib/env";
import { DEFAULT_PRESET, DEFAULT_RELEVANCE, ENUM_FILTERS, PRESETS } from "./schema";

export const DEFAULT_TZ = env.NEXT_PUBLIC_DEFAULT_TIMEZONE;

/** IANA tz; garbage in the URL falls back to the default tz. */
const parseAsTimezone = createParser({
  parse: (v: string) => (isValidTimezone(v) ? v : null),
  serialize: (v: string) => v,
});

/** Only well-formed UUIDs survive hand-edited URLs. */
const parseAsUuid = createParser({
  parse: (v: string) => (UuidSchema.safeParse(v).success ? v : null),
  serialize: (v: string) => v,
});

/** BR-041: same normalisation as the API, so hand-edited URLs match stored phrases; invalid → dropped. */
const parseAsPhrase = createParser({
  parse: (v: string) => normalizePhrase(v),
  serialize: (v: string) => v,
});

const enumArray = <T extends string>(values: readonly T[]) =>
  parseAsArrayOf(parseAsStringLiteral(values)).withDefault([]);

/** URL state for the shared filter bar — docs/02-architecture/03-frontend-design.md §4. Arrays are CSV. */
export const filterParsers = {
  preset: parseAsStringLiteral(PRESETS).withDefault(DEFAULT_PRESET),
  from: parseAsIsoDateTime,
  to: parseAsIsoDateTime,
  tz: parseAsTimezone.withDefault(DEFAULT_TZ),
  queryIds: parseAsArrayOf(parseAsUuid).withDefault([]),
  // BR-016: default relevant.
  relevance: parseAsArrayOf(parseAsStringLiteral(ENUM_FILTERS.relevance)).withDefault(DEFAULT_RELEVANCE),
  sentiment: enumArray(ENUM_FILTERS.sentiment),
  safety: enumArray(ENUM_FILTERS.safety),
  intent: enumArray(ENUM_FILTERS.intent),
  topic: enumArray(ENUM_FILTERS.topic),
  language: enumArray(ENUM_FILTERS.language),
  analysisStatus: enumArray(ENUM_FILTERS.analysisStatus),
  phrase: parseAsArrayOf(parseAsPhrase).withDefault([]),
  q: parseAsString,
  sort: parseAsStringLiteral(MENTION_SORTS).withDefault("newest"),
  compare: parseAsBoolean.withDefault(false),
};

export const filterUrlOptions = { clearOnDefault: true, history: "replace" } as const;

export const serializeFilters = createSerializer(filterParsers, { clearOnDefault: true });
