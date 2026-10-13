import { createSearchParamsCache } from "nuqs/server";
import { filterParsers } from "./parsers";

/** Server Components can read filters with `filtersCache.parse(searchParams)`. */
export const filtersCache = createSearchParamsCache(filterParsers);
