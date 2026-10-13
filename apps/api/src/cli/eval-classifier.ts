/**
 * `pnpm --filter @how-about-me/api eval:classifier -- --dataset <path.jsonl> [--out <report.md>]
 *   [--json <raw.json>] [--brand-context <text>] [--limit N] [--concurrency N] [--fail-on-gate]`
 *
 * Classifier + safety evaluation (T-079, FR-118, FR-117) — docs/04-qa/03-ai-evaluation-plan.md §3.
 * Uses the provider factories, so `PROVIDERS_MODE=fake` (default) runs offline and `real` calls OpenAI.
 * Exit 0 when the run completes (even with gate FAIL, unless `--fail-on-gate`); 1 on arg/dataset/config errors.
 * Only item ids reach the output — never item text.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";
import { loadEnv } from "../config/env.schema";
import { createContentClassifier, createSafetyProvider } from "../modules/providers/providers.module";
import { parseDataset } from "./eval/dataset";
import { gateRows, renderReport } from "./eval/report";
import { runEval, summarize } from "./eval/runner";

export type EvalArgs = {
  dataset: string;
  out?: string;
  json?: string;
  brandContext?: string;
  limit?: number;
  concurrency: number;
  failOnGate: boolean;
};

const ArgsSchema = z.object({
  dataset: z.string().min(1, "--dataset is required"),
  out: z.string().min(1).optional(),
  json: z.string().min(1).optional(),
  brandContext: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  concurrency: z.coerce.number().int().min(1).max(10).default(2),
  failOnGate: z.boolean().default(false),
});

export class EvalArgsError extends Error {}

/** Parses argv (without node/script). Throws `EvalArgsError` with a readable message. */
export function parseEvalArgs(argv: readonly string[]): EvalArgs {
  let values: Record<string, string | boolean | undefined>;
  try {
    ({ values } = parseArgs({
      args: argv.filter((a) => a !== "--"),
      strict: true,
      options: {
        dataset: { type: "string" },
        out: { type: "string" },
        json: { type: "string" },
        "brand-context": { type: "string" },
        limit: { type: "string" },
        concurrency: { type: "string" },
        "fail-on-gate": { type: "boolean" },
      },
    }));
  } catch (err: unknown) {
    throw new EvalArgsError(err instanceof Error ? err.message : String(err));
  }
  const r = ArgsSchema.safeParse({
    dataset: values.dataset ?? "",
    out: values.out,
    json: values.json,
    brandContext: values["brand-context"],
    limit: values.limit,
    concurrency: values.concurrency,
    failOnGate: values["fail-on-gate"] === true,
  });
  if (!r.success) throw new EvalArgsError(r.error.issues.map((i) => i.message).join("; "));
  return r.data;
}

/**
 * The eval touches neither the DB nor auth, but shares the API env schema. Non-secret placeholders fill
 * those fields when unset so the CLI runs on a bare checkout; real values in env always win.
 */
export const EVAL_ENV_PLACEHOLDERS = {
  DATABASE_URL: "postgresql://unused@localhost/eval",
  SUPABASE_URL: "http://localhost",
} as const;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function main(): Promise<number> {
  const args = parseEvalArgs(process.argv.slice(2));
  const cfg = loadEnv({ ...EVAL_ENV_PLACEHOLDERS, ...process.env });
  const raw = readFileSync(args.dataset, "utf8");
  const all = parseDataset(raw);
  const items = args.limit ? all.slice(0, args.limit) : all;
  const classifier = createContentClassifier(cfg);
  const safety = createSafetyProvider(cfg);
  const brandContext = args.brandContext ?? cfg.ANALYSIS_BRAND_CONTEXT;

  process.stderr.write(
    `eval:classifier — mode ${cfg.PROVIDERS_MODE}, classifier ${classifier.model}, safety ${safety.model}, ${items.length} item(s)\n`,
  );
  const results = await runEval(items, { classifier, safety, brandContext, concurrency: args.concurrency });
  const summary = summarize(results);
  const report = renderReport(summary, {
    generatedAt: new Date(),
    datasetPath: args.dataset,
    datasetSha256: sha256(raw),
    providersMode: cfg.PROVIDERS_MODE,
    classifier: { provider: classifier.provider, model: classifier.model, promptVersion: classifier.promptVersion },
    safety: { name: safety.name, model: safety.model },
    brandContextSha256: sha256(brandContext),
    brandContextLength: brandContext.length,
    pricesConfigured: cfg.ANALYSIS_PRICE_INPUT_PER_1M > 0 || cfg.ANALYSIS_PRICE_OUTPUT_PER_1M > 0,
  });

  if (args.out) writeFileSync(args.out, `${report}\n`);
  else process.stdout.write(`${report}\n`);
  if (args.json) {
    // Raw per-item predictions for later diffing; ids only, no text.
    const rows = results.map((r) => ({
      id: r.item.id,
      gold: r.item.labels,
      pred: r.prediction,
      error: r.error,
      usage: r.usage,
    }));
    writeFileSync(args.json, `${JSON.stringify({ summary, items: rows }, null, 2)}\n`);
  }
  const failed = gateRows(summary).filter((g) => !g.pass).length;
  process.stderr.write(`done — ${summary.errors.length} error(s), ${failed} gate(s) FAIL\n`);
  return args.failOnGate && failed > 0 ? 1 : 0;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`eval:classifier failed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
