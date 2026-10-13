import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
} from "@nestjs/common";
import { Writable } from "node:stream";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  BulkReanalyzeBodySchema,
  MentionsExportQuerySchema,
  MentionsListQuerySchema,
  type BulkReanalyzeBody,
  type BulkReanalyzeResponse,
  type MentionDetail,
  type MentionsExportQuery,
  type MentionsListQuery,
  type MentionsPage,
  type ReanalyzeResponse,
} from "@how-about-me/contracts";
import { type AuthedRequest, type AuthUser, CurrentUser } from "../../common/auth/current-user.decorator";
import { AllowRoleWhenSetting } from "../../common/auth/project-setting-gate.decorator";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { ExportService } from "../export/export.service";
import { MentionsService } from "./mentions.service";

/** docs/02-architecture/05-api-contract.md §7 — FR-115, FR-015. */
@ApiTags("mentions")
@ApiBearerAuth()
@Controller("projects/:projectId/mentions")
export class MentionsController {
  constructor(
    private readonly mentions: MentionsService,
    private readonly exporter: ExportService,
    @InjectPinoLogger(MentionsController.name) private readonly logger: PinoLogger,
  ) {}

  /** FR-150/152/153/161 — read for all project roles (no @Roles; ProjectRoleGuard enforces membership). */
  @Get()
  list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(MentionsListQuerySchema)) query: MentionsListQuery,
  ): Promise<MentionsPage> {
    return this.mentions.list(projectId, query);
  }

  /**
   * T-147 / FR-180/181: CSV export of the filtered list. Viewer only when `allowViewerExport` (FR-032), enforced
   * server-side (FR-015). Declared ABOVE `:mentionId` so it is not shadowed. Errors before streaming stay JSON
   * envelopes (content type is set via StreamableFile, not @Header); a mid-stream failure destroys the socket.
   */
  @Get("export.csv")
  @Header("Cache-Control", "no-store")
  @Roles("admin", "analyst", "viewer")
  @AllowRoleWhenSetting("viewer", "allowViewerExport")
  async exportCsv(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(MentionsExportQuerySchema)) query: MentionsExportQuery,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<StreamableFile> {
    const out = await this.exporter.exportMentionsCsv(projectId, query, user.id, req.id ?? null);
    return new StreamableFile(out.stream, {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="${out.filename}"`,
    }).setErrorHandler((err, res) => {
      this.logger.warn({ projectId, event: "mentions.export_stream_failed", err: err.name }, "export stream failed");
      // Headers (200) are already sent → cannot send an envelope; cut the connection (Express ServerResponse).
      const r: unknown = res;
      if (r instanceof Writable) r.destroy(err);
      else if (!res.destroyed) res.end();
    });
  }

  /**
   * FR-154 — read for all project roles. Keep static GET routes (e.g. `export.csv`) declared ABOVE this one,
   * otherwise `:mentionId` shadows them (Nest matches in declaration order).
   */
  @Get(":mentionId")
  detail(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("mentionId", ParseUUIDPipe) mentionId: string,
  ): Promise<MentionDetail> {
    return this.mentions.detail(projectId, mentionId);
  }

  /** T-145 / FR-196: bulk re-analysis by list filters — admin only (personas §3, no analyst gate). */
  @Post("reanalyze")
  @HttpCode(200)
  @Roles("admin")
  bulkReanalyze(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(zod(BulkReanalyzeBodySchema)) body: BulkReanalyzeBody,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<BulkReanalyzeResponse> {
    return this.mentions.bulkReanalyze(projectId, body, user.id, req.id ?? null);
  }

  @Post(":mentionId/reanalyze")
  @HttpCode(202)
  @Roles("admin", "analyst")
  @AllowRoleWhenSetting("analyst", "allowAnalystReanalyze")
  reanalyze(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("mentionId", ParseUUIDPipe) mentionId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<ReanalyzeResponse> {
    return this.mentions.reanalyze(projectId, mentionId, user.id, req.id ?? null);
  }
}
