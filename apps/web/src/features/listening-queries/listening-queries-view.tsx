"use client";

import { Plus } from "@untitledui/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/base/buttons/button";
import { Toggle } from "@/components/base/toggle/toggle";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { PageHeader } from "@/features/shared/page-header";
import { ErrorState, QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { ApiError } from "@/lib/api/client";
import { flattenUnique } from "@/lib/query/infinite-list";
import { useListeningQueries } from "./api";
import { QueriesTable } from "./queries-table";
import type { QueryActionHandlers } from "./query-actions-menu";

const DEFAULT_TZ = "Asia/Ho_Chi_Minh";

const toStateError = (err: unknown) =>
  err
    ? err instanceof ApiError
      ? { code: err.code, message: err.message, requestId: err.requestId }
      : { message: "Phản hồi không hợp lệ từ máy chủ." }
    : null;

type Props = QueryActionHandlers & { onCreate?: () => void };

/** /listening-queries body (T-046, UX §3.5). Drawer + mutations are wired by #43 through the handler props. */
export function ListeningQueriesView({ onCreate, ...handlers }: Props) {
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
  const pagesLoaded = (list.data?.pages.length ?? 0) > 0;

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

  const createButton = isAdmin ? (
    <Button size="sm" iconLeading={Plus} isDisabled={!onCreate} onClick={onCreate}>
      Thêm truy vấn
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Truy vấn theo dõi" actions={createButton} />
      <div className="flex items-center gap-3">
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
          <QueriesTable items={items} tz={project?.timezone ?? DEFAULT_TZ} isAdmin={isAdmin} {...handlers} />
          {pagesLoaded && list.isFetchNextPageError ? (
            <ErrorState error={toStateError(list.error) ?? {}} onRetry={() => void list.fetchNextPage()} />
          ) : null}
          {list.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                color="secondary"
                size="sm"
                className="plaque"
                isLoading={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                Tải thêm
              </Button>
            </div>
          ) : null}
        </div>
      </QueryState>
    </div>
  );
}
