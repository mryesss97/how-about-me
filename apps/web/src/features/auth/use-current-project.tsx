"use client";

import type { MeResponse } from "@how-about-me/contracts";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type PropsWithChildren } from "react";
import { useMe } from "./use-me";

export const PROJECT_STORAGE_KEY = "ham.projectId";

type Project = MeResponse["projects"][number];

export type CurrentProjectValue = {
  project: Project | null;
  projects: Project[];
  isLoading: boolean;
  error: unknown;
  setProjectId: (id: string) => void;
};

const CurrentProjectContext = createContext<string | null | undefined>(undefined);
const SetProjectContext = createContext<(id: string) => void>(() => {});

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
const readStored = () => window.localStorage.getItem(PROJECT_STORAGE_KEY);
// Server snapshot is null so SSR and hydration agree; the stored id is applied after hydration.
const readServer = () => null;

/** Holds the selected project id (persisted in localStorage `ham.projectId`). */
export function CurrentProjectProvider({ children }: PropsWithChildren) {
  const projectId = useSyncExternalStore(subscribe, readStored, readServer);
  const setProjectId = useCallback((id: string) => {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, id);
    listeners.forEach((l) => l());
  }, []);
  return (
    <SetProjectContext.Provider value={setProjectId}>
      <CurrentProjectContext.Provider value={projectId}>{children}</CurrentProjectContext.Provider>
    </SetProjectContext.Provider>
  );
}

/** Current project: stored id if still a membership, else `projects[0]`; `null` when the user has no project. */
export function useCurrentProject(): CurrentProjectValue {
  const me = useMe();
  const storedId = useContext(CurrentProjectContext) ?? null;
  const setProjectId = useContext(SetProjectContext);
  const projects = useMemo(() => me.data?.projects ?? [], [me.data]);
  const project = projects.find((p) => p.id === storedId) ?? projects[0] ?? null;
  return { project, projects, isLoading: me.isLoading, error: me.error, setProjectId };
}
