import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { FakeContentClassifier } from "../analysis/providers/fake-classifier.provider";
import { FakeSafetyProvider } from "../analysis/providers/fake-safety.provider";
import { CONTENT_CLASSIFIER, SAFETY_PROVIDER, type SafetyProvider } from "../analysis/providers/interfaces";
import { OpenAiModerationProvider } from "../analysis/providers/openai-moderation.provider";
import { FakeThreadsProvider } from "../integrations/threads/fake-threads.provider";
import { SOCIAL_DISCOVERY_PROVIDER } from "../integrations/threads/social-discovery.provider";

/**
 * Single place where `PROVIDERS_MODE` decides between the offline fakes and the real adapters (T-013,
 * FR-112, FR-047) — docs/02-architecture/02-backend-design.md §10.
 *
 * Consumers inject the tokens, never the classes, so no module outside this one imports a provider
 * implementation (TC-INT-014). The safety adapter is real since T-071; Threads (T-039) and the
 * classifier (T-072) still fail fast in `PROVIDERS_MODE=real` with a message naming the missing task
 * instead of silently running against nothing.
 */
@Global()
@Module({
  providers: [
    {
      provide: SOCIAL_DISCOVERY_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) =>
        cfg.PROVIDERS_MODE === "fake" ? new FakeThreadsProvider() : notImplemented("ThreadsDiscoveryProvider", "T-039"),
    },
    {
      provide: SAFETY_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: createSafetyProvider,
    },
    {
      provide: CONTENT_CLASSIFIER,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) =>
        cfg.PROVIDERS_MODE === "fake"
          ? new FakeContentClassifier({
              inputPer1M: cfg.ANALYSIS_PRICE_INPUT_PER_1M,
              outputPer1M: cfg.ANALYSIS_PRICE_OUTPUT_PER_1M,
            })
          : notImplemented("OpenAiStructuredClassifier", "T-072"),
    },
  ],
  exports: [SOCIAL_DISCOVERY_PROVIDER, SAFETY_PROVIDER, CONTENT_CLASSIFIER],
})
export class ProvidersModule {}

/** `SAFETY_PROVIDER` factory (T-071): fake offline, OpenAI moderation in real mode; fails fast on bad config. */
export function createSafetyProvider(cfg: AppConfig): SafetyProvider {
  if (cfg.PROVIDERS_MODE === "fake") return new FakeSafetyProvider();
  if (cfg.SAFETY_PROVIDER !== "openai")
    throw new Error(`Unsupported SAFETY_PROVIDER "${cfg.SAFETY_PROVIDER}" (supported: openai).`);
  if (!cfg.OPENAI_API_KEY) throw new Error("PROVIDERS_MODE=real requires OPENAI_API_KEY for the safety provider.");
  return new OpenAiModerationProvider({
    apiKey: cfg.OPENAI_API_KEY,
    model: cfg.SAFETY_MODEL,
    baseUrl: cfg.OPENAI_BASE_URL,
    timeoutMs: cfg.OPENAI_TIMEOUT_MS,
    maxRetries: cfg.OPENAI_MAX_RETRIES,
  });
}

function notImplemented(name: string, task: string): never {
  throw new Error(`PROVIDERS_MODE=real requires ${name}, which is implemented in ${task}. Use PROVIDERS_MODE=fake.`);
}
