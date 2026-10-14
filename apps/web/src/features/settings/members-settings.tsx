"use client";

import { Plus } from "@untitledui/icons";
import { useState } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useMe } from "@/features/auth/use-me";
import { QueryState } from "@/features/shared/query-state";
import { useMembers } from "./api";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MembersTable } from "./members-table";
import { SettingsBoard } from "./settings-board";

function MembersLoaded({ pid, timezone }: { pid: string; timezone: string }) {
  const me = useMe();
  const q = useMembers(pid);
  const [inviteOpen, setInviteOpen] = useState(false);
  return (
    <SettingsBoard
      title="Thành viên"
      action={
        <button
          type="button"
          className="plaque-button inline-flex items-center gap-1.5 px-3 py-1.5"
          onClick={() => setInviteOpen(true)}
        >
          <Plus aria-hidden className="size-4" />
          Mời thành viên
        </button>
      }
    >
      <QueryState
        isLoading={q.isLoading}
        error={q.error}
        isEmpty={q.data?.length === 0}
        emptyTitle="Chưa có thành viên"
        onRetry={() => void q.refetch()}
      >
        {q.data ? <MembersTable pid={pid} members={q.data} timezone={timezone} currentUserId={me.data?.id} /> : null}
      </QueryState>
      <InviteMemberDialog pid={pid} isOpen={inviteOpen} onClose={() => setInviteOpen(false)} />
    </SettingsBoard>
  );
}

/** Page body for `/settings/members` (admin only via `RequireRole`; the API enforces FR-015). */
export function MembersSettings() {
  const { project, isLoading } = useCurrentProject();
  if (isLoading || !project) return <QueryState isLoading>{null}</QueryState>;
  return <MembersLoaded key={project.id} pid={project.id} timezone={project.timezone} />;
}
