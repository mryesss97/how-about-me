import type { Member, UserRole } from "@how-about-me/contracts";

export type MemberRow = {
  userId: string;
  role: string;
  createdAt: Date;
  user: { email: string; displayName: string | null };
};

/** Maps a project_members row (+ profile) to the `Member` DTO — FR-033. */
export function toMember(row: MemberRow): Member {
  return {
    userId: row.userId,
    email: row.user.email,
    displayName: row.user.displayName,
    role: row.role as UserRole,
    createdAt: row.createdAt.toISOString(),
  };
}
