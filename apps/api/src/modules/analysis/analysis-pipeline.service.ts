import { Inject, Injectable } from "@nestjs/common";
import { ClassifierOutputSchema, parseClassifierOutput, type ClassifierOutput } from "@how-about-me/contracts";
import { SAFETY_POLICY_VERSION, TAXONOMY_VERSION } from "@how-about-me/taxonomy";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { v7 as uuidv7 } from "uuid";
import { ProviderError } from "../../common/errors/provider.error";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { PrismaService } from "../../database/prisma.service";
import { AnalysisLockLostError, truncateMessage } from "./analysis-failure-policy";
import { AnalysisService, type ClaimedRun, type RunUsage, type RunVersions } from "./analysis.service";
import {
  CONTENT_CLASSIFIER,
  SAFETY_PROVIDER,
  type AnalysisContext,
  type ClassifierInput,
  type ContentClassifier,
  type SafetyProvider,
  type Usage,
} from "./providers/interfaces";
import type { RunProcessor } from "./run-processor";
import { toSafetyAnalysis, type SafetyAnalysis } from "./safety/safety-mapping";

type RelevanceResult = Awaited<ReturnType<ContentClassifier["relevance"]>>;

/** Outcome of the provider calls for one run, before persistence. */
type Outcome =
  | {
      kind: "irrelevant";
      relevance: ClassifierOutput["relevance"];
      language: ClassifierOutput["language"] | null;
      usage: Usage[];
    }
  | { kind: "full"; output: ClassifierOutput; safety: SafetyAnalysis; usage: Usage[] };

const EXPLANATION_MAX = 200;

/** Decimal(5,4) columns: round to 4 places before writing. */
function conf(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function zodIssues(issues: readonly { path: readonly PropertyKey[]; message: string }[]): string[] {
  return issues.slice(0, 10).map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`);
}

function validateClassify(out: ClassifierOutput & { usage: Usage }): string[] | null {
  const { usage: _usage, ...rest } = out;
  const r = parseClassifierOutput(rest);
  return r.ok ? null : r.issues;
}

function validateRelevance(out: { relevance: ClassifierOutput["relevance"] }): string[] | null {
  const r = ClassifierOutputSchema.shape.relevance.safeParse(out.relevance);
  return r.success ? null : zodIssues(r.error.issues);
}

function issuesOf(error: ProviderError): string[] {
  const d: unknown = error.details;
  if (d && typeof d === "object" && "issues" in d && Array.isArray(d.issues)) {
    const list = d.issues.filter((x): x is string => typeof x === "string");
    if (list.length > 0) return list;
  }
  return [error.message];
}

function sumUsage(items: Usage[]): RunUsage {
  return {
    inputTokens: items.reduce((a, u) => a + u.inputTokens, 0),
    outputTokens: items.reduce((a, u) => a + u.outputTokens, 0),
    estimatedCostUsd: items.reduce((a, u) => a + u.estimatedCostUsd, 0),
  };
}

/**
 * Analysis pipeline (T-074) — docs/02-architecture/07-analysis-pipeline.md §2.
 * load post → revision/empty checks → relevance gate → safety → classify → one transaction that inserts
 * `post_analyses` (+ intents/topics), completes the run with the 7 version fields and moves
 * `social_posts.current_analysis_id` (FR-100, FR-102, FR-103, FR-110, FR-114).
 * Classifier output is validated here too (FR-119) and gets one corrective retry (FR-113, T-075); other
 * provider errors are rethrown to the worker, which applies `analysis-failure-policy.ts`.
 */
@Injectable()
export class AnalysisPipelineService implements RunProcessor {
  private readonly versions: RunVersions;

  constructor(
    private readonly prisma: PrismaService,
    private readonly analysis: AnalysisService,
    @Inject(CONTENT_CLASSIFIER) private readonly classifier: ContentClassifier,
    @Inject(SAFETY_PROVIDER) private readonly safety: SafetyProvider,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectPinoLogger(AnalysisPipelineService.name) private readonly logger: PinoLogger,
  ) {
    // BR-023: same inputs as computeEffectiveVersion().
    this.versions = {
      classifierProvider: classifier.provider,
      classifierModel: classifier.model,
      promptVersion: classifier.promptVersion,
      taxonomyVersion: TAXONOMY_VERSION,
      safetyProvider: safety.name,
      safetyModel: safety.model,
      safetyPolicyVersion: SAFETY_POLICY_VERSION,
    };
  }

  async process(run: ClaimedRun): Promise<void> {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: run.postId },
      select: { text: true, username: true, revision: true, project: { select: { name: true, description: true } } },
    });
    // doc 07 §1: the post changed (or vanished) after the run was enqueued.
    if (!post || post.revision !== run.sourceRevision) {
      await this.analysis.markSkipped(run.id, run.lockedBy, "superseded");
      return;
    }
    const text = post.text?.trim() ?? "";
    // TC-ANA-023: no provider call for empty text.
    if (!text) {
      await this.analysis.markSkipped(run.id, run.lockedBy, "empty_text");
      return;
    }

    const input: ClassifierInput = {
      text,
      username: post.username ?? undefined,
      matchedTerms: await this.matchedTerms(run.postId),
      brandContext: this.brandContext(post.project),
    };
    const ctx: AnalysisContext = { requestId: run.id, projectId: run.projectId, runId: run.id };
    const outcome = await this.callProviders(input, ctx);
    await this.persist(run, outcome);
    this.logger.info({ runId: run.id, kind: outcome.kind }, "analysis run completed");
  }

  /** All provider calls live here (doc 07 §2 order: relevance gate before safety). */
  private async callProviders(input: ClassifierInput, ctx: AnalysisContext): Promise<Outcome> {
    const usage: Usage[] = [];
    if (this.cfg.ANALYSIS_TWO_STEP) {
      const rel = await this.withCorrection<RelevanceResult>(
        (i) => this.classifier.relevance(i, ctx),
        validateRelevance,
        input,
        ctx,
        usage,
      );
      if (rel.relevance.label === "irrelevant") {
        // TC-ANA-005: classify() and moderate() are not called for irrelevant posts.
        return { kind: "irrelevant", relevance: rel.relevance, language: rel.language ?? null, usage };
      }
      const safety = await this.safety.moderate({ text: input.text }, ctx);
      const { usage: _cu, ...output } = await this.withCorrection(
        (i) => this.classifier.classify(i, ctx),
        validateClassify,
        { ...input, languageHint: rel.language },
        ctx,
        usage,
      );
      return { kind: "full", output, safety: toSafetyAnalysis(safety), usage };
    }
    // Single-step: classify first, gate on its relevance, then moderate (sequential, saves moderation calls).
    const { usage: _cu, ...output } = await this.withCorrection(
      (i) => this.classifier.classify(i, ctx),
      validateClassify,
      input,
      ctx,
      usage,
    );
    if (output.relevance.label === "irrelevant") {
      return { kind: "irrelevant", relevance: output.relevance, language: output.language, usage };
    }
    const safety = await this.safety.moderate({ text: input.text }, ctx);
    return { kind: "full", output, safety: toSafetyAnalysis(safety), usage };
  }

  /**
   * FR-113 corrective retry: invalid output (pipeline validation or adapter `ANALYSIS_SCHEMA_INVALID`) is retried
   * once with the issues appended to the prompt; still invalid → `ANALYSIS_SCHEMA_INVALID`. Usage of every
   * returned output is pushed to `usage`. Issues are `path: message` only, never post text (BR-027).
   */
  private async withCorrection<T extends { usage: Usage }>(
    call: (input: ClassifierInput) => Promise<T>,
    validate: (out: T) => string[] | null,
    input: ClassifierInput,
    ctx: AnalysisContext,
    usage: Usage[],
  ): Promise<T> {
    const attempt = async (i: ClassifierInput): Promise<{ out: T } | { issues: string[] }> => {
      try {
        const out = await call(i);
        usage.push(out.usage);
        const issues = validate(out);
        return issues ? { issues } : { out };
      } catch (e: unknown) {
        if (e instanceof ProviderError && e.code === "ANALYSIS_SCHEMA_INVALID") return { issues: issuesOf(e) };
        throw e;
      }
    };
    const first = await attempt(input);
    if ("out" in first) return first.out;
    this.logger.warn({ runId: ctx.runId, issues: first.issues }, "classifier output invalid; corrective retry");
    const second = await attempt({ ...input, correction: { issues: first.issues } });
    if ("out" in second) return second.out;
    throw new ProviderError(
      "ANALYSIS_SCHEMA_INVALID",
      truncateMessage(`after corrective retry: ${second.issues.join("; ")}`),
    );
  }

  private async persist(run: ClaimedRun, outcome: Outcome): Promise<void> {
    const analysisId = uuidv7();
    const relevance = outcome.kind === "full" ? outcome.output.relevance : outcome.relevance;
    const base = {
      id: analysisId,
      analysisRunId: run.id,
      postId: run.postId,
      projectId: run.projectId,
      relevanceLabel: relevance.label,
      relevanceConfidence: conf(relevance.confidence),
      // BR-027: only the short explanation is stored, never raw provider output or reasoning.
      relevanceExplanation: relevance.explanation.slice(0, EXPLANATION_MAX),
    };
    await this.prisma.$transaction(async (tx) => {
      if (outcome.kind === "irrelevant") {
        await tx.postAnalysis.create({
          data: {
            ...base,
            languageCode: outcome.language,
            summary: "",
            overallModelConfidence: conf(relevance.confidence),
          },
        });
      } else {
        const o = outcome.output;
        const s = outcome.safety;
        await tx.postAnalysis.create({
          data: {
            ...base,
            sentimentLabel: o.sentiment.label,
            sentimentConfidence: conf(o.sentiment.confidence),
            // BR-017/BR-018: safety fields come from the moderation provider only.
            safetyLevel: s.safetyLevel,
            safetyFlagged: s.safetyFlagged,
            safetyCategoryScores: s.safetyCategoryScores,
            languageCode: o.language,
            summary: o.summary,
            // doc 08: overall = min(relevance, sentiment).
            overallModelConfidence: conf(Math.min(o.relevance.confidence, o.sentiment.confidence)),
          },
        });
        await tx.analysisIntent.createMany({
          data: o.intents.map((i) => ({ analysisId, label: i.label, confidence: conf(i.confidence) })),
        });
        await tx.analysisTopic.createMany({
          data: o.topics.map((t) => ({ analysisId, label: t.label, confidence: conf(t.confidence) })),
        });
      }
      const ok = await this.analysis.markCompleted(run.id, run.lockedBy, sumUsage(outcome.usage), tx, {
        versions: this.versions,
        skippedReason: outcome.kind === "irrelevant" ? "irrelevant" : undefined,
      });
      // Watchdog took the run back: roll back so no orphan analysis remains.
      if (!ok) throw new AnalysisLockLostError(run.id);
      await this.analysis.setCurrentAnalysis(tx, run.postId, run.id, analysisId);
    });
  }

  private async matchedTerms(postId: string): Promise<string[]> {
    const matches = await this.prisma.postQueryMatch.findMany({
      where: { postId, excludedByTerms: false },
      select: { query: { select: { queryValue: true } } },
    });
    return [...new Set(matches.map((m) => m.query.queryValue))];
  }

  private brandContext(project: { name: string; description: string | null }): string {
    if (this.cfg.ANALYSIS_BRAND_CONTEXT) return this.cfg.ANALYSIS_BRAND_CONTEXT;
    return project.description ? `${project.name}: ${project.description}` : project.name;
  }
}
