# ADR-0009 · Three-state relevance and default exclusion of `irrelevant`

**Status:** Accepted · **Date:** 2026-09-05

## Context

Short generic terms (`1zone`) produce false positives ("time zone"). Binary relevance forces bad calls on ambiguous posts.

## Decision

Relevance ∈ {`relevant`, `uncertain`, `irrelevant`} with confidence & explanation; low-confidence relevance collapses to `uncertain`. Analytics default filter `relevant`; `uncertain` toggleable; `irrelevant` excluded unless explicitly requested. Irrelevant posts skip expensive classification.

## Consequences

- Cleaner metrics, lower cost, a natural review queue. − Some real mentions may sit in `uncertain` until reviewed; coverage numbers must show it.

## Alternatives

Binary relevance (noisier metrics) · exclusion-terms only (insufficient).
