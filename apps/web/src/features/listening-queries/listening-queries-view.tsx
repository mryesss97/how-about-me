"use client";

import type { ListeningQuery } from "@how-about-me/contracts";
import { Plus } from "@untitledui/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { PlaqueButton } from "@/features/shared/plaque-button";
import { Toggle } from "@/components/base/toggle/toggle";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { PageHeader } from "@/features/shared/page-header";
import { ErrorState, QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { ApiError } from "@/lib/api/client";
import { flattenUnique } from "@/lib/query/infinite-list";
import { useListeningQueries, useListeningQuery } from "./api";
import { BackfillDialog } from "./backfill-dialog";
import { DeleteQueryDialog } from "./delete-query-dialog";
import { QueriesListMobile } from "./queries-list-mobile";
import { QueriesTable } from "./queries-table";
import { QueryFormDrawer } from "./query-form-drawer";
import { useQueryActions } from "./use-query-actions";

const DEFAULT_TZ = "Asia/Ho_Chi_Minh";

const toStateError = (err: unknown) =>
  err
    ? err instanceof ApiError
      ? { code: err.code, message: err.message, requestId: err.requestId }
      : { message: "Phản hồi không hợp lệ từ máy chủ." }
    : null;

type DrawerState = { mode: "create" } | { mode: "edit"; query: ListeningQuery };

/** /listening-queries body (T-046, UX §3.5). Create/edit drawer, row mutations and `?edit=<id>` deep link (#43). */
export function ListeningQueriesView() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { project } = useCurrentProject();
  const { hasRole, isLoading: roleLoading } = useRole();
  // While the role loads no admin control renders, so nothing flashes (BR-033: UX only).
  const isAdmin = !roleLoading && hasRole(["admin"]);
  const includeDeleted = search?.get("deleted") === "1";
  const list = useListeningQueries(project?.id, { includeDeleted });
  const items = useMemo(() => flattenUnique(list.data?.pages ?? []), [list.data]);
  const enabledCount = items.filter((q) => q.enabled && !q.deletedAt).length;
  const pagesLoaded = (list.data?.pages.length ?? 0) > 0;
  const pid = project?.id ?? "";
  const actions = useQueryActions(pid);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [deleting, setDeleting] = useState<ListeningQuery | null>(null);
  const [backfillTarget, setBackfillTarget] = useState<ListeningQuery | null>(null);

  // `?edit=<id>`: opens the edit drawer for a query, fetched when outside the loaded list (duplicate link, FR-053).
  const editId = isAdmin ? (search?.get("edit") ?? null) : null;
  const editInList = editId ? items.find((q) => q.id === editId) : undefined;
  const editFetched = useListeningQuery(pid, editId && pagesLoaded && !editInList ? editId : null);
  const editTarget = editInList ?? editFetched.data;
  const wantsNew = isAdmin && search?.get("new") === "1";
  const activeDrawer: DrawerState | null =
    drawer ??
    (editTarget && !editTarget.deletedAt ? { mode: "edit", query: editTarget } : wantsNew ? { mode: "create" } : null);

  const setIncludeDeleted = useCallback(
    (on: boolean) => {
      const next = new URLSearchParams(search?.toString());
      if (on) next.set("deleted", "1");
      else next.delete("deleted");
      const qs = next.toString();
      router.replace(`${pathname ?? "/listening-queries"}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, search],
  );

  const writeEdit = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(search?.toString());
      if (id) next.set("edit", id);
      else next.delete("edit");
      const qs = next.toString();
      router.replace(`${pathname ?? "/listening-queries"}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, search],
  );

  // #346 flows-9: `?new=1` (from the Threads verify toast) opens the create drawer; closing drops the param.
  const dropNew = () => {
    const next = new URLSearchParams(search?.toString());
    next.delete("new");
    const qs = next.toString();
    router.replace(`${pathname ?? "/listening-queries"}${qs ? `?${qs}` : ""}`);
  };

  const closeDrawer = () => {
    setDrawer(null);
    if (editId) writeEdit(null);
    if (wantsNew) dropNew();
  };
  const openExisting = (id: string) => {
    const found = items.find((q) => q.id === id);
    if (found && !found.deletedAt) setDrawer({ mode: "edit", query: found });
    else writeEdit(id);
  };

  // Handlers only for admins; the menu/toggle hide without them (BR-033: UX only, API enforces FR-015).
  const handlers = isAdmin
    ? {
        onEdit: (q: ListeningQuery) => setDrawer({ mode: "edit", query: q }),
        onRun: actions.onRun,
        onBackfill: setBackfillTarget,
        onToggle: actions.onToggle,
        onDelete: setDeleting,
        onRestore: actions.onRestore,
      }
    : {};

  const createButton = isAdmin ? (
    <Button size="sm" iconLeading={Plus} isDisabled={!project} onClick={() => setDrawer({ mode: "create" })}>
      Thêm truy vấn
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Truy vấn theo dõi" actions={createButton} />
      {/* Toolbar panel (#340 ops-1): count of loaded queries; the API list has no total, so "đã tải" while more pages remain. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] bg-[var(--enamel-white)] px-4 py-3">
        <p className="text-sm text-secondary" data-testid="queries-count">
          {list.hasNextPage ? "Đã tải " : ""}
          {items.length} truy vấn · {enabledCount} đang bật
        </p>
        <Toggle size="sm" label="Hiện truy vấn đã xoá" isSelected={includeDeleted} onChange={setIncludeDeleted} />
      </div>
      <QueryState
        isLoading={!project || list.isLoading}
        error={pagesLoaded ? null : toStateError(list.error)}
        onRetry={() => void list.refetch()}
        isEmpty={items.length === 0}
        skeleton={<SkeletonBlock lines={6} className="operate-board p-4" />}
        emptyIllustration="empty"
        emptyTitle={includeDeleted ? "Chưa có truy vấn nào" : "Chưa có truy vấn đang hoạt động"}
        emptyDescription={
          isAdmin
            ? "Thêm từ khoá hoặc chủ đề để bắt đầu thu thập bài viết."
            : "Quản trị viên dự án sẽ thêm từ khoá hoặc chủ đề để thu thập bài viết."
        }
        emptyAction={createButton}
      >
        <div className="flex flex-col gap-3">
          <QueriesTable
            items={items}
            tz={project?.timezone ?? DEFAULT_TZ}
            isAdmin={isAdmin}
            busyId={actions.togglingId}
            {...handlers}
          />
          <QueriesListMobile
            items={items}
            tz={project?.timezone ?? DEFAULT_TZ}
            isAdmin={isAdmin}
            busyId={actions.togglingId}
            {...handlers}
          />
          {pagesLoaded && list.isFetchNextPageError ? (
            <ErrorState error={toStateError(list.error) ?? {}} onRetry={() => void list.fetchNextPage()} />
          ) : null}
          {list.hasNextPage ? (
            <div className="flex justify-center">
              <PlaqueButton isLoading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                Tải thêm
              </PlaqueButton>
            </div>
          ) : null}
        </div>
      </QueryState>
      {isAdmin && project && activeDrawer ? (
        <QueryFormDrawer
          key={activeDrawer.mode === "edit" ? activeDrawer.query.id : "new"}
          pid={project.id}
          mode={activeDrawer.mode}
          query={activeDrawer.mode === "edit" ? activeDrawer.query : undefined}
          isOpen
          onClose={closeDrawer}
          onOpenExisting={openExisting}
          onRunNow={actions.onRun}
        />
      ) : null}
      {isAdmin && project ? (
        <BackfillDialog
          pid={project.id}
          query={backfillTarget}
          tz={project.timezone ?? DEFAULT_TZ}
          onClose={() => setBackfillTarget(null)}
        />
      ) : null}
      {isAdmin ? (
        <DeleteQueryDialog
          query={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={(q) => {
            setDeleting(null);
            actions.onConfirmDelete(q);
          }}
        />
      ) : null}
    </div>
  );
}
