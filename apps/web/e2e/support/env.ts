import { existsSync, readFileSync } from "node:fs";

// E2E credentials come from env only — never commit passwords or session files.
export type E2eRole = "admin" | "viewer";

export interface E2eCredentials {
  email: string;
  password: string;
}

export function getCredentials(role: E2eRole): E2eCredentials | undefined {
  const prefix = role === "admin" ? "E2E_ADMIN" : "E2E_VIEWER";
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  return email && password ? { email, password } : undefined;
}

export function hasCredentials(role: E2eRole): boolean {
  return getCredentials(role) !== undefined;
}

export function storageStatePath(role: E2eRole): string {
  return `e2e/.auth/${role}.json`;
}

/** True when auth.setup saved a real session for the role (it writes an empty state when it skips). */
export function hasSession(role: E2eRole): boolean {
  const path = storageStatePath(role);
  if (!existsSync(path)) return false;
  const state = JSON.parse(readFileSync(path, "utf8")) as { cookies?: unknown[]; origins?: unknown[] };
  return (state.cookies?.length ?? 0) + (state.origins?.length ?? 0) > 0;
}
