"use client";

import type { ListeningQuery, SearchType } from "@how-about-me/contracts";
import { parseDate } from "@internationalized/date";
import { useState } from "react";
import { toast } from "sonner";
import { DateRangePicker } from "@/components/application/date-picker/date-range-picker";
import { Button } from "@/components/base/buttons/button";
import { RadioButton, RadioGroup } from "@/components/base/radio-buttons/radio-buttons";
import { SettingsDialog } from "@/features/shared/settings-dialog";
import { searchTypeLabelVi } from "@/lib/semantics/labels";
import { queryErrorMessage, runningJobId, useBackfillListeningQuery } from "./api";
import { BackfillProgress } from "./backfill-progress";
import {
  BACKFILL_DEFAULT_TZ,
  BACKFILL_MAX_DAYS,
  type CalendarRange,
  defaultRange,
  toBackfillBody,
  todayIn,
  validateBackfillRange,
} from "./backfill-form";

type Props = { pid: string; query: ListeningQuery | null; onClose: () => void; tz?: string };

/** Backfill (FR-063, UX §3.5): pick a window + search type, then poll the queued job in the same dialog. */
export function BackfillDialog({ pid, query, onClose, tz = BACKFILL_DEFAULT_TZ }: Props) {
  return (
    <SettingsDialog isOpen={!!query} onClose={onClose} title="Lấy dữ liệu cũ">
      {/* Keyed so reopening for another query starts from a fresh form. */}
      {query ? <BackfillBody key={query.id} pid={pid} query={query} onClose={onClose} tz={tz} /> : null}
    </SettingsDialog>
  );
}

function BackfillBody({
  pid,
  query,
  onClose,
  tz,
}: {
  pid: string;
  query: ListeningQuery;
  onClose: () => void;
  tz: string;
}) {
  const backfill = useBackfillListeningQuery(pid);
  const [range, setRange] = useState<CalendarRange>(() => defaultRange(tz));
  const [searchType, setSearchType] = useState<SearchType>("RECENT");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<{ id: string; alreadyRunning: boolean } | null>(null);
  const rangeError = validateBackfillRange(range, new Date(), tz);

  if (job) return <BackfillProgress pid={pid} jobId={job.id} alreadyRunning={job.alreadyRunning} onClose={onClose} />;

  const submit = () => {
    if (rangeError || backfill.isPending) return;
    backfill.mutate(
      { id: query.id, body: toBackfillBody(range, searchType, tz) },
      {
        onSuccess: (res) => {
          toast.success("Đã xếp lịch lấy dữ liệu cũ");
          setJob({ id: res.jobId, alreadyRunning: false });
        },
        onError: (err) => {
          // BR-010 / FR-058: one active job per query — follow it instead of creating a duplicate.
          const jobId = runningJobId(err);
          if (jobId) setJob({ id: jobId, alreadyRunning: true });
          else setError(queryErrorMessage(err));
        },
      },
    );
  };

  return (
    <>
      <p className="text-sm text-tertiary">
        Lấy lại bài nhắc cũ của <strong className="text-secondary">{query.displayName}</strong> trong khoảng ngày đã
        chọn.
      </p>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-secondary">Khoảng ngày</span>
        <DateRangePicker
          aria-label="Khoảng ngày lấy dữ liệu cũ"
          value={{ start: parseDate(range.start), end: parseDate(range.end) }}
          maxValue={parseDate(todayIn(tz))}
          onChange={(v) => {
            if (!v) return;
            setError(null);
            setRange({ start: v.start.toString().slice(0, 10), end: v.end.toString().slice(0, 10) });
          }}
        />
        <span className="text-sm text-tertiary">Tối đa {BACKFILL_MAX_DAYS} ngày.</span>
      </div>
      {/* #344: visible label = accessible name; API still receives RECENT/TOP (BR-008). */}
      <div className="flex flex-col gap-1.5">
        <span id="backfill-search-type" className="text-sm font-medium text-secondary">
          Thứ tự lấy
        </span>
        <RadioGroup
          aria-labelledby="backfill-search-type"
          value={searchType}
          onChange={(v) => {
            setError(null);
            setSearchType(v === "TOP" ? "TOP" : "RECENT");
          }}
        >
          <RadioButton value="RECENT" label={searchTypeLabelVi.RECENT} />
          <RadioButton value="TOP" label={searchTypeLabelVi.TOP} />
        </RadioGroup>
        <span className="text-sm text-tertiary">Nổi bật lấy các bài có nhiều tương tác trước.</span>
      </div>
      {rangeError || error ? (
        <p role="alert" className="text-sm text-error-primary">
          {rangeError ?? error}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button color="secondary" onClick={onClose}>
          Huỷ
        </Button>
        <Button isLoading={backfill.isPending} isDisabled={!!rangeError || backfill.isPending} onClick={submit}>
          Bắt đầu lấy dữ liệu
        </Button>
      </div>
    </>
  );
}
