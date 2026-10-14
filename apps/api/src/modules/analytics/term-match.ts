import { Prisma } from "@prisma/client";

/** BR-042: lowercased NFC post text with whitespace and `, ; |` runs collapsed to one space. */
export function normalizedPostText(textCol: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`regexp_replace(lower(normalize(coalesce(${textCol}, ''), NFC)), '[\\s,;|]+', ' ', 'g')`;
}

/**
 * BR-042: a post mentions `term` when its normalised text contains it, or a key phrase of its current analysis
 * contains it. `strpos` keeps `%`/`_` literal. `term` is SQL so callers pass a column or a bound `::text` value.
 * `normText` lets callers reuse a precomputed normalised text column.
 */
export function mentionsTermSql(args: {
  normText: Prisma.Sql;
  analysisIdCol: Prisma.Sql;
  term: Prisma.Sql;
}): Prisma.Sql {
  return Prisma.sql`(strpos(${args.normText}, ${args.term}) > 0
    OR EXISTS (SELECT 1 FROM analysis_phrases ap
                WHERE ap.analysis_id = ${args.analysisIdCol} AND strpos(ap.phrase, ${args.term}) > 0))`;
}
