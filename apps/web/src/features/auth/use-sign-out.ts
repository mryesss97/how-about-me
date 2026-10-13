"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { hardSignOut } from "./sign-out";

export function useSignOut(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(() => hardSignOut(queryClient), [queryClient]);
}
