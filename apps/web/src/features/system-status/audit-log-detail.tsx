"use client";

import type { AuditLog } from "@how-about-me/contracts";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { auditMetadataRows } from "./audit-format";

/** #343 (ops-12): sanitized metadata (FR-200) as label/value fields; raw JSON behind "Xem JSON"; request id kept. */
export function AuditLogDetail({ log, tz }: { log: AuditLog; tz: string }) {
  const [json, setJson] = useState(false);
  const rows = auditMetadataRows(log.metadata, tz);
  const jsonId = `audit-json-${log.id}`;
  return (
    <div className="flex flex-col gap-2">
      {rows.length > 0 ? (
        <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1 text-sm" data-testid="audit-meta">
          {rows.map((r) => (
            <div key={r.key} className="contents">
              <dt className="text-tertiary">{r.label}</dt>
              <dd className="min-w-0 break-words text-primary">
                {r.href ? (
                  <Link href={r.href} className="text-brand-secondary hover:underline">
                    {r.value}
                  </Link>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-tertiary">Không có dữ liệu bổ sung.</p>
      )}
      {log.metadata ? (
        <div>
          <Button
            color="link-gray"
            size="sm"
            aria-expanded={json}
            aria-controls={jsonId}
            onClick={() => setJson((v) => !v)}
          >
            {json ? "Ẩn JSON" : "Xem JSON"}
          </Button>
          {json ? (
            <pre id={jsonId} className="mt-1 max-h-64 overflow-auto text-xs break-all whitespace-pre-wrap">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
      {log.requestId ? <p className="text-xs text-tertiary">Mã yêu cầu: {log.requestId}</p> : null}
    </div>
  );
}
