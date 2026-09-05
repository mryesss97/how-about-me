import { z } from "zod";

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "boolean" ? v : ["1", "true", "yes", "on"].includes(v.toLowerCase())));
const int = (def: number) => z.coerce.number().int().default(def);
const num = (def: number) => z.coerce.number().default(def);

/** Typed, fail-fast environment schema — docs/06-engineering/06-environment-variables.md */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    APP_ROLE: z.enum(["api", "worker", "all"]).default("all"),
    PORT: int(4000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    CORS_ORIGINS: z.string().default("http://localhost:3000"),
    SWAGGER_ENABLED: bool.default(true),
    APP_VERSION: z.string().default(process.env.GIT_SHA ?? "dev"),

    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),

    SUPABASE_URL: z.url().optional(),
    SUPABASE_JWKS_URL: z.url().optional(),
    SUPABASE_JWT_SECRET: z.string().min(16).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    /** Test-only: HS256 secret used by test helpers to mint tokens when SUPABASE_* are absent. */
    AUTH_TEST_JWT_SECRET: z.string().min(16).optional(),

    INTEGRATION_ENCRYPTION_KEYS: z
      .string()
      .default("{}")
      .transform((s, ctx) => {
        try {
          const parsed = JSON.parse(s) as Record<string, string>;
          return parsed;
        } catch {
          ctx.addIssue({ code: "custom", message: "INTEGRATION_ENCRYPTION_KEYS must be JSON {keyId: base64}" });
          return z.NEVER;
        }
      }),
    INTEGRATION_ENCRYPTION_ACTIVE_KEY: z.string().default("k1"),

    PROVIDERS_MODE: z.enum(["fake", "real"]).default("fake"),
    THREADS_API_BASE_URL: z.url().default("https://graph.threads.net/v1.0"),
    THREADS_REQUEST_TIMEOUT_MS: int(15000),
    THREADS_APP_ID: z.string().optional(),
    THREADS_APP_SECRET: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    SAFETY_PROVIDER: z.string().default("openai"),
    SAFETY_MODEL: z.string().default("omni-moderation-latest"),
    ANALYSIS_CLASSIFIER_PROVIDER: z.string().default("openai"),
    ANALYSIS_CLASSIFIER_MODEL: z.string().default(""),
    ANALYSIS_PRICE_INPUT_PER_1M: num(0),
    ANALYSIS_PRICE_OUTPUT_PER_1M: num(0),
    ANALYSIS_BRAND_CONTEXT: z
      .string()
      .default("1Zone and Eventista are Vietnamese live-event, ticketing and fan-membership brands."),

    COLLECTOR_TICK_MS: int(60_000),
    COLLECTOR_MAX_CONCURRENT_QUERIES: int(3),
    COLLECTOR_MAX_PAGES_PER_JOB: int(50),
    COLLECTOR_PAGE_LIMIT: int(50),
    COLLECTOR_MAX_RETRIES: int(3),
    COLLECTOR_LOCK_STALE_MINUTES: int(15),
    COLLECTOR_MAX_WINDOW_DAYS: int(30),
    COLLECTOR_MAX_BACKFILL_DAYS: int(30),
    COLLECTOR_CIRCUIT_FAILURE_THRESHOLD: int(5),
    COLLECTOR_CIRCUIT_OPEN_SECONDS: int(600),

    ANALYSIS_POLL_MS: int(5000),
    ANALYSIS_BATCH_SIZE: int(20),
    ANALYSIS_CONCURRENCY: int(3),
    ANALYSIS_MAX_ATTEMPTS: int(3),
    ANALYSIS_TWO_STEP: bool.default(false),
    ANALYSIS_SKIP_SUMMARY_FOR_SPAM: bool.default(true),
    ANALYSIS_DAILY_BUDGET_USD: num(5),
    ANALYSIS_BULK_MAX: int(2000),

    EXPORT_MAX_ROWS: int(10_000),
    METRICS_TOKEN: z.string().optional(),
    RETENTION_POSTS_DAYS: int(365),
    RETENTION_RUNS_DAYS: int(365),
    RETENTION_SYNC_JOBS_DAYS: int(180),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.PROVIDERS_MODE === "real") {
      if (!env.OPENAI_API_KEY)
        ctx.addIssue({ code: "custom", path: ["OPENAI_API_KEY"], message: "required in real mode" });
      if (!env.ANALYSIS_CLASSIFIER_MODEL)
        ctx.addIssue({ code: "custom", path: ["ANALYSIS_CLASSIFIER_MODEL"], message: "required in real mode" });
    }
    if (env.NODE_ENV !== "test" && !env.SUPABASE_URL && !env.SUPABASE_JWT_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_URL"],
        message: "SUPABASE_URL (JWKS) or SUPABASE_JWT_SECRET is required",
      });
    }
    if (env.NODE_ENV === "production" && Object.keys(env.INTEGRATION_ENCRYPTION_KEYS).length === 0) {
      ctx.addIssue({ code: "custom", path: ["INTEGRATION_ENCRYPTION_KEYS"], message: "required in production" });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const r = EnvSchema.safeParse(source);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return r.data;
}
