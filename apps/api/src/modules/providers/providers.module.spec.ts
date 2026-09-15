import { Test } from "@nestjs/testing";
import { AppConfigModule } from "../../config/config.module";
import { FakeContentClassifier } from "../analysis/providers/fake-classifier.provider";
import { FakeSafetyProvider } from "../analysis/providers/fake-safety.provider";
import { CONTENT_CLASSIFIER, SAFETY_PROVIDER } from "../analysis/providers/interfaces";
import { FakeThreadsProvider } from "../integrations/threads/fake-threads.provider";
import { SOCIAL_DISCOVERY_PROVIDER } from "../integrations/threads/social-discovery.provider";
import { ProvidersModule } from "./providers.module";

/** Minimum env `loadEnv()` needs; no DB connection is opened by this module. */
const BASE_ENV = { DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/unused?schema=public" };

async function compile(env: Record<string, string>) {
  const previous = { ...process.env };
  Object.assign(process.env, BASE_ENV, env);
  try {
    return await Test.createTestingModule({ imports: [AppConfigModule, ProvidersModule] }).compile();
  } finally {
    process.env = previous;
  }
}

describe("ProvidersModule (PROVIDERS_MODE wiring, FR-112, FR-047)", () => {
  it("binds the three provider tokens to the fakes in fake mode", async () => {
    const moduleRef = await compile({ PROVIDERS_MODE: "fake" });
    expect(moduleRef.get(SOCIAL_DISCOVERY_PROVIDER)).toBeInstanceOf(FakeThreadsProvider);
    expect(moduleRef.get(SAFETY_PROVIDER)).toBeInstanceOf(FakeSafetyProvider);
    expect(moduleRef.get(CONTENT_CLASSIFIER)).toBeInstanceOf(FakeContentClassifier);
  });

  it("defaults to fake mode, so a fresh clone runs offline", async () => {
    const moduleRef = await compile({});
    expect(moduleRef.get(SOCIAL_DISCOVERY_PROVIDER)).toBeInstanceOf(FakeThreadsProvider);
  });

  it("fails fast in real mode, naming the task that implements the adapter", async () => {
    await expect(compile({ PROVIDERS_MODE: "real" })).rejects.toThrow(/T-039|T-071|T-072/);
  });

  it("passes the configured token prices to the fake classifier", async () => {
    const moduleRef = await compile({
      PROVIDERS_MODE: "fake",
      ANALYSIS_PRICE_INPUT_PER_1M: "1",
      ANALYSIS_PRICE_OUTPUT_PER_1M: "1",
    });
    const classifier = moduleRef.get<FakeContentClassifier>(CONTENT_CLASSIFIER);
    const out = await classifier.classify(
      { text: "Vé 1Zone mở bán chưa mọi người?", matchedTerms: ["1zone"], brandContext: "1Zone" },
      { requestId: "r", projectId: "p", runId: "run" },
    );
    expect(out.usage.estimatedCostUsd).toBeGreaterThan(0);
  });
});
