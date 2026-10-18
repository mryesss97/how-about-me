"use client";

import { Plus } from "@untitledui/icons";
import { useState } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useMe } from "@/features/auth/use-me";
import { QueryState } from "@/features/shared/query-state";
import { useMembers } from "./api";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MembersTable } from "./members-table";
import { SettingsBoard, SettingsBoardSkeleton } from "./settings-board";
import { Button } from "@/components/base/buttons/button";

function MembersLoaded({ pid, timezone }: { pid: string; timezone: string }) {
  const me = useMe();
  const q = useMembers(pid);
  const [inviteOpen, setInviteOpen] = useState(false);
  return (
    <SettingsBoard
      title="Thành viên"
      action={
        // #348: "create new" CTA = primary button, top-right of its board (DESIGN.md "Create action").
        <Button size="sm" color="primary" iconLeading={Plus} onClick={() => setInviteOpen(true)}>
          Mời thành viên
        </Button>
      }
    >
      <QueryState
        isLoading={q.isLoading}
        error={q.error}
        isEmpty={q.data?.length === 0}
        emptyTitle="Chưa có thành viên"
        errorVariant="inline"
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
  if (isLoading || !project) return <SettingsBoardSkeleton title="Thành viên" />;
  return <MembersLoaded key={project.id} pid={project.id} timezone={project.timezone} />;
}
