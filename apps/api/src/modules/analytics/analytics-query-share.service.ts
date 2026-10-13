import { Injectable } from "@nestjs/common";
import type { AnalyticsQuery, QueryShareResponse } from "@how-about-me/contracts";
import { AppError } from "../../common/errors/app.error";
import { resolveAnalyticsQuery } from "./analytics-filters";
import { AnalyticsQueryShareRepository } from "./analytics-query-share.repository";
import { toQueryShare } from "./query-share";

/** T-150 — FR-145 keyword share; docs/02-architecture/05-api-contract.md §6. */
@Injectable()
export class AnalyticsQueryShareService {
  constructor(private readonly repo: AnalyticsQueryShareRepository) {}

  async queryShare(projectId: string, query: AnalyticsQuery): Promise<QueryShareResponse> {
    const project = await this.repo.findProjectTimezone(projectId);
    if (!project) throw new AppError("NOT_FOUND", "Project not found");
    const { rows, denominator } = await this.repo.queryShareCounts(resolveAnalyticsQuery(query, project).scope);
    return toQueryShare(rows, denominator);
  }
}
