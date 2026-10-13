// Shared listening-query normalisation (BR-004, BR-005); reused by seed and listening-queries module.
import { QueryType, SearchMode } from "@prisma/client";

export function normalizeQuery(q: { queryValue: string; queryType: QueryType }): {
  queryValue: string;
  searchMode: SearchMode;
} {
  return {
    // BR-004: store topic tags/keywords without leading '#'
    queryValue: q.queryValue.trim().replace(/^#+/, "").trim(),
    // BR-005: search_mode derived from query_type
    searchMode: q.queryType === QueryType.keyword ? SearchMode.KEYWORD : SearchMode.TAG,
  };
}
