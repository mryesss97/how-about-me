import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CryptoService } from "../../common/crypto/crypto.service";
import { PrismaService } from "../../database/prisma.service";
import { AppConfigModule } from "../../config/config.module";
import { FakeContentClassifier } from "../analysis/providers/fake-classifier.provider";
import { FakeSafetyProvider } from "../analysis/providers/fake-safety.provider";
import { CONTENT_CLASSIFIER, SAFETY_PROVIDER } from "../analysis/providers/interfaces";
import { FakeThreadsProvider } from "../integrations/threads/fake-threads.provider";
import { SOCIAL_DISCOVERY_PROVIDER } from "../integrations/threads/social-discovery.provider";
import { loadEnv } from "../../config/env.schema";
import { OpenAiModerationProvider } from "../analysis/providers/openai-moderation.provider";
import { OpenAiStructuredClassifier } from "../analysis/providers/openai-structured.classifier";
import { createContentClassifier, createSafetyProvider, ProvidersModule, storeTokenSource } from "./providers.module";

/** Stands in for the global Prisma/Crypto modules; the token-source factory only needs them in real mode. */
@Global()
@Module({
  providers: [
    { provide: PrismaService, useValue: {} },
    { provide: CryptoService, useValue: {} },
  ],
  exports: [PrismaService, CryptoService],
})
class FakeInfraModule {}

/** Minimum env `loadEnv()` needs; no DB connection is opened by this module. */
const BASE_ENV = { DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/unused?schema=public" };

async function compile(env: Record<string, string>) {
  const previous = { ...process.env };
  Object.assign(process.env, BASE_ENV, env);
  try {
    return await Test.createTestingModule({ imports: [AppConfigModule, FakeInfraModule, ProvidersModule] }).compile();
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

  describe("createSafetyProvider (T-071)", () => {
    const cfg = (env: Record<string, string>) => loadEnv({ NODE_ENV: "test", ...BASE_ENV, ...env });

    it("builds the OpenAI moderation adapter in real mode with a key", () => {
      const provider = createSafetyProvider(cfg({ PROVIDERS_MODE: "real", OPENAI_API_KEY: "sk-test" }));
      expect(provider).toBeInstanceOf(OpenAiModerationProvider);
      expect(provider.model).toBe("omni-moderation-latest");
    });

    it("rejects an unknown SAFETY_PROVIDER", () => {
      expect(() =>
        createSafetyProvider(cfg({ PROVIDERS_MODE: "real", OPENAI_API_KEY: "sk-test", SAFETY_PROVIDER: "acme" })),
      ).toThrow(/Unsupported SAFETY_PROVIDER/);
    });

    it("fails fast without OPENAI_API_KEY in real mode", () => {
      expect(() => createSafetyProvider(cfg({ PROVIDERS_MODE: "real" }))).toThrow(/OPENAI_API_KEY/);
    });

    it("keeps the fake in fake mode", () => {
      expect(createSafetyProvider(cfg({ PROVIDERS_MODE: "fake" }))).toBeInstanceOf(FakeSafetyProvider);
    });
  });

  describe("createContentClassifier (T-072)", () => {
    const cfg = (env: Record<string, string>) => loadEnv({ NODE_ENV: "test", ...BASE_ENV, ...env });
    const fakeCfg = cfg({ PROVIDERS_MODE: "fake" });

    it("builds the OpenAI structured classifier in real mode with key and model", () => {
      const c = createContentClassifier({
        ...fakeCfg,
        PROVIDERS_MODE: "real",
        OPENAI_API_KEY: "sk-test",
        ANALYSIS_CLASSIFIER_MODEL: "m-test",
      });
      expect(c).toBeInstanceOf(OpenAiStructuredClassifier);
      expect(c.model).toBe("m-test");
      expect(c.promptVersion).toBe("classifier-v2");
    });

    it("FR-120: ANALYSIS_PROMPT_VERSION selects the prompt (classifier-v1 rollback)", () => {
      const c = createContentClassifier({
        ...fakeCfg,
        PROVIDERS_MODE: "real",
        OPENAI_API_KEY: "sk-test",
        ANALYSIS_CLASSIFIER_MODEL: "m-test",
        ANALYSIS_PROMPT_VERSION: "classifier-v1",
      });
      expect(c.promptVersion).toBe("classifier-v1");
    });

    it("fails fast without the model or the key in real mode", () => {
      expect(() =>
        createContentClassifier({
          ...fakeCfg,
          PROVIDERS_MODE: "real",
          OPENAI_API_KEY: "sk-test",
          ANALYSIS_CLASSIFIER_MODEL: "",
        }),
      ).toThrow(/ANALYSIS_CLASSIFIER_MODEL/);
      expect(() =>
        createContentClassifier({ ...fakeCfg, PROVIDERS_MODE: "real", ANALYSIS_CLASSIFIER_MODEL: "m-test" }),
      ).toThrow(/OPENAI_API_KEY/);
    });

    it("rejects an unknown ANALYSIS_CLASSIFIER_PROVIDER", () => {
      expect(() =>
        createContentClassifier({
          ...fakeCfg,
          PROVIDERS_MODE: "real",
          OPENAI_API_KEY: "k",
          ANALYSIS_CLASSIFIER_MODEL: "m",
          ANALYSIS_CLASSIFIER_PROVIDER: "acme",
        }),
      ).toThrow(/Unsupported ANALYSIS_CLASSIFIER_PROVIDER/);
    });

    it("keeps the fake in fake mode", () => {
      expect(createContentClassifier(fakeCfg)).toBeInstanceOf(FakeContentClassifier);
    });
  });
});

describe("storeTokenSource (#34, FR-040)", () => {
  it("returns the stored token", async () => {
    const source = storeTokenSource({ read: async () => "tok" });
    await expect(source.getAccessToken("p1")).resolves.toBe("tok");
  });

  it("fails with INTEGRATION_NOT_CONFIGURED when no token is stored", async () => {
    const source = storeTokenSource({ read: async () => null });
    await expect(source.getAccessToken("p1")).rejects.toMatchObject({ code: "INTEGRATION_NOT_CONFIGURED" });
  });
});
