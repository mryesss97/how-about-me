# ADR-0007 · AI providers behind `SafetyProvider` / `ContentClassifier`; models configurable

**Status:** Accepted · **Date:** 2026-09-05

## Context

Safety via OpenAI Moderation initially; classifier LLM must remain configurable and not hard-coded into the domain.

## Decision

Two interfaces in `AnalysisModule`. Implementations chosen by env (`SAFETY_PROVIDER`, `ANALYSIS_CLASSIFIER_PROVIDER`, `ANALYSIS_CLASSIFIER_MODEL`). Structured output validated by a strict JSON schema shared via `packages/contracts`. Fake providers for tests. Every result stores provider/model/prompt/taxonomy/policy versions.

## Consequences

- Swap models without touching domain; deterministic tests; auditable results.
  − Prompt tuning per model; provider-specific structured-output features hidden behind the adapter.

## Alternatives

Direct OpenAI SDK calls inside services (lock-in, untestable) · LangChain (unnecessary abstraction weight).
