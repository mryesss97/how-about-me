import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { FakeContentClassifier } from "../analysis/providers/fake-classifier.provider";
import { FakeSafetyProvider } from "../analysis/providers/fake-safety.provider";
import { CONTENT_CLASSIFIER, SAFETY_PROVIDER } from "../analysis/providers/interfaces";
import { FakeThreadsProvider } from "../integrations/threads/fake-threads.provider";
import { SOCIAL_DISCOVERY_PROVIDER } from "../integrations/threads/social-discovery.provider";

/**
 * Single place where `PROVIDERS_MODE` decides between the offline fakes and the real adapters (T-013,
 * FR-112, FR-047) — docs/02-architecture/02-backend-design.md §10.
 *
 * Consumers inject the tokens, never the classes, so no module outside this one imports a provider
 * implementation (TC-INT-014). The real adapters land in T-039 (Threads), T-071 (safety) and T-072
 * (classifier); until then `PROVIDERS_MODE=real` fails fast with a message naming the missing task
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
      useFactory: (cfg: AppConfig) =>
        cfg.PROVIDERS_MODE === "fake" ? new FakeSafetyProvider() : notImplemented("OpenAiModerationProvider", "T-071"),
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

function notImplemented(name: string, task: string): never {
  throw new Error(`PROVIDERS_MODE=real requires ${name}, which is implemented in ${task}. Use PROVIDERS_MODE=fake.`);
}
