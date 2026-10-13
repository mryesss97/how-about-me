"use client";

import { Plus } from "@untitledui/icons";
import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useMe } from "@/features/auth/use-me";
import { QueryState } from "@/features/shared/query-state";
import { useMembers } from "./api";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MembersTable } from "./members-table";

function MembersLoaded({ pid, timezone }: { pid: string; timezone: string }) {
  const me = useMe();
  const q = useMembers(pid);
  const [inviteOpen, setInviteOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-md font-semibold text-primary">Members</h2>
        <Button size="sm" iconLeading={Plus} onClick={() => setInviteOpen(true)}>
          Invite member
        </Button>
      </div>
      <QueryState
        isLoading={q.isLoading}
        error={q.error}
        isEmpty={q.data?.length === 0}
        emptyTitle="No members yet"
        onRetry={() => void q.refetch()}
      >
        {q.data ? <MembersTable pid={pid} members={q.data} timezone={timezone} currentUserId={me.data?.id} /> : null}
      </QueryState>
      <InviteMemberDialog pid={pid} isOpen={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}

/** Page body for `/settings/members` (admin only via `RequireRole`; the API enforces FR-015). */
export function MembersSettings() {
  const { project, isLoading } = useCurrentProject();
  if (isLoading || !project) return <QueryState isLoading>{null}</QueryState>;
  return <MembersLoaded key={project.id} pid={project.id} timezone={project.timezone} />;
}
