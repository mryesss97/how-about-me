import type { Override, UserRef } from "@how-about-me/contracts";
import type { OverrideUser, OverrideWithUsers } from "./overrides.repository";

/** Unwraps the `{ "value": … }` jsonb envelope (doc 04 §4.13); anything else → null. */
export function unwrapValue(v: unknown): unknown {
  if (v !== null && typeof v === "object" && "value" in v) return (v as { value: unknown }).value;
  return null;
}

function userRef(id: string | null, users: Map<string, OverrideUser>): UserRef | null {
  if (!id) return null;
  const u = users.get(id);
  return u ? { id: u.id, displayName: u.displayName, email: u.email } : null;
}

/** analysis_overrides row → Override DTO (api-contract §7). Timestamps ISO UTC. */
export function toOverrideDto({ row, users }: OverrideWithUsers): Override {
  return {
    id: row.id,
    field: row.field,
    previousValue: unwrapValue(row.previousValue),
    value: unwrapValue(row.overrideValue),
    reason: row.reason,
    reviewedBy: userRef(row.reviewedBy, users),
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    revokedBy: userRef(row.revokedBy, users),
  };
}
