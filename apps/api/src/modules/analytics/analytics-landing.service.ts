import { Injectable } from "@nestjs/common";
import { LANDING_DEFAULT_RANGE_DAYS, type LandingTermsQuery, type LandingTermsResponse } from "@how-about-me/contracts";
import { parseProjectSettings } from "../../common/auth/project-settings";
import { AppError } from "../../common/errors/app.error";
import { DAY_MS, toRangeDto } from "../../common/time/range";
import { resolveAnalyticsQuery } from "./analytics-filters";
import { AnalyticsLandingRepository } from "./analytics-landing.repository";
import { toLandingTermRows } from "./landing-terms";

/** #261 — FR-149 landing terms × sentiment; docs/02-architecture/05-api-contract.md §6. */
@Injectable()
export class AnalyticsLandingService {
  constructor(private readonly repo: AnalyticsLandingRepository) {}

  async landingTerms(projectId: string, query: LandingTermsQuery): Promise<LandingTermsResponse> {
    const project = await this.repo.findProjectWithSettings(projectId);
    if (!project) throw new AppError("NOT_FOUND", "Project not found");
    const terms = parseProjectSettings(project.settings).landingTerms;
    const { scope } = resolveAnalyticsQuery({ ...query, compare: false }, project, new Date(), {
      defaultRangeMs: LANDING_DEFAULT_RANGE_DAYS * DAY_MS,
    });
    const { cells, sentimentAnalyzed } = await this.repo.landingTermCounts(scope, terms);
    return {
      range: { ...toRangeDto(scope.range, scope.timezone), timezone: scope.timezone },
      sentimentAnalyzed,
      rows: toLandingTermRows(terms, cells),
    };
  }
}
