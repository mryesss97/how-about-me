"use client";

import { useCallback, useMemo } from "react";
import { useQueryStates } from "nuqs";
import { type ApiTarget, toApiParams } from "./api-params";
import { filterParsers, filterUrlOptions } from "./parsers";
import type { Filters } from "./schema";
import { floorToMinute } from "./time-range";

/** Shared URL-synced filters for Overview & Mentions (TC-DASH-005). */
export function useFilters(target: ApiTarget = "analytics") {
  const [state, setState] = useQueryStates(filterParsers, filterUrlOptions);
  const filters: Filters = state;
  // Relative presets: `now` floored to the minute keeps query keys stable (no refetch loop).
  const nowKey = floorToMinute(new Date()).getTime();
  const apiParams = useMemo(() => toApiParams(filters, { target, now: new Date(nowKey) }), [filters, target, nowKey]);
  const setFilters = useCallback((patch: Partial<Filters>) => void setState(patch), [setState]);
  const reset = useCallback(() => void setState(null), [setState]);
  return { filters, setFilters, reset, apiParams };
}
