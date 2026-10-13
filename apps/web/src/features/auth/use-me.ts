"use client";

import { MeResponseSchema, type MeResponse } from "@how-about-me/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { qk, staleTimes } from "@/lib/query/keys";

export async function fetchMe(): Promise<MeResponse> {
  return MeResponseSchema.parse(await apiFetch<unknown>("/me"));
}

/** Current user + project memberships (`projects` may be empty for non-members — handled by T-033). */
export function useMe() {
  return useQuery({ queryKey: qk.me(), queryFn: fetchMe, staleTime: staleTimes.me });
}
