import { Readable } from "node:stream";
import { Inject, Injectable } from "@nestjs/common";
import type { MentionsExportQuery } from "@how-about-me/contracts";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { AppError } from "../../common/errors/app.error";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { AuditService } from "../audit/audit.service";
import { resolveFilterScope } from "../mentions/mentions-query";
import { toMentionListItem } from "../mentions/mentions.mapper";
import { type MentionPageRow, MentionsRepository } from "../mentions/mentions.repository";
import { CSV_BOM } from "./csv";
import { EXPORT_AUDIT_ACTION, ExportThrottle } from "./export-throttle";
import { exportFilename, mentionsCsvHeader, toMentionsCsvRow } from "./mentions-csv";

export const EXPORT_TX_TIMEOUT_MS = 30_000;
export const EXPORT_HYDRATE_CHUNK = 500;

export type MentionsCsvExport = { filename: string; stream: Readable; rowCount: number };

/** CSV export of the filtered mentions list — FR-180/181, FR-200, NFR-017 (T-147). */
@Injectable()
export class ExportService {
  constructor(
    private readonly repo: MentionsRepository,
    private readonly audit: AuditService,
    private readonly throttle: ExportThrottle,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectPinoLogger(ExportService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Same base set B, `q` and `sort` as the list (BR-002, BR-016, BR-025). Throttle → cap check → audit run in one
   * short tx; a single `LIMIT cap+1` statement both checks the cap and fetches the rows (consistent snapshot).
   * Root rows (≤ cap) stay in memory; hydration + serialization are streamed in chunks outside the tx.
   * Much larger caps need the async job (FR-182, P2).
   */
  async exportMentionsCsv(
    projectId: string,
    query: MentionsExportQuery,
    actorUserId: string,
    requestId: string | null,
    now: Date = new Date(),
  ): Promise<MentionsCsvExport> {
    const s = resolveFilterScope(query, projectId, now);
    const cap = this.cfg.EXPORT_MAX_ROWS;
    const rows = await this.repo.transaction(
      async (tx) => {
        await this.throttle.assertAllowed(tx, actorUserId);
        const found = await this.repo.listPage(s.scope, s.q, s.sort, null, cap, tx);
        if (found.length > cap) {
          // FR-181: refuse before any byte is sent; tx rollback → no audit, no throttle token.
          throw new AppError(
            "EXPORT_TOO_LARGE",
            `Export exceeds the ${cap.toLocaleString("en-US")}-row limit. Narrow your filters.`,
            { cap },
          );
        }
        // FR-200 / US-171: filters + row count only, never post text. Also the throttle token.
        await this.audit.record(
          {
            projectId,
            actorUserId,
            action: EXPORT_AUDIT_ACTION,
            entityType: "monitoring_project",
            entityId: projectId,
            requestId,
            metadata: { format: "csv", filters: query, rowCount: found.length },
          },
          tx,
        );
        return found;
      },
      { timeout: EXPORT_TX_TIMEOUT_MS },
    );
    return {
      filename: exportFilename(now, s.scope.timezone),
      stream: Readable.from(this.generate(projectId, rows)),
      rowCount: rows.length,
    };
  }

  private async *generate(projectId: string, rows: MentionPageRow[]): AsyncGenerator<string> {
    const started = Date.now();
    let done = false;
    try {
      yield CSV_BOM + mentionsCsvHeader();
      for (let i = 0; i < rows.length; i += EXPORT_HYDRATE_CHUNK) {
        const chunk = rows.slice(i, i + EXPORT_HYDRATE_CHUNK);
        const analysisIds = chunk.flatMap((r) => (r.analysis_id ? [r.analysis_id] : []));
        const [hydrated, analyzedAt] = await Promise.all([
          this.repo.hydrate(
            chunk.map((r) => r.post_id),
            analysisIds,
          ),
          this.repo.analyzedAtByAnalysis(analysisIds),
        ]);
        yield chunk
          .map((r) =>
            toMentionsCsvRow(
              toMentionListItem(r, hydrated),
              r.analysis_id ? (analyzedAt.get(r.analysis_id) ?? null) : null,
            ),
          )
          .join("");
      }
      done = true;
    } finally {
      // No q / post text in logs (FR-200).
      this.logger.info(
        {
          projectId,
          rowCount: rows.length,
          durationMs: Date.now() - started,
          aborted: !done,
          event: "mentions.export_completed",
        },
        "mentions export finished",
      );
    }
  }
}
