# ADR-0012 · Provider tokens encrypted at rest with key rotation

**Status:** Accepted · **Date:** 2026-09-05

## Context

Threads long-lived tokens must be updatable after refresh and never exposed. Hosting secret stores are not always mutable from the app.

## Decision

Store tokens in `integration_secrets` encrypted with AES-256-GCM using keys from `INTEGRATION_ENCRYPTION_KEYS` (map key_id → key) and `INTEGRATION_ENCRYPTION_ACTIVE_KEY`. Ciphertext records its `key_id`; a `secrets:rewrap` command re-encrypts under the active key. Plaintext exists only in worker memory during provider calls.

## Consequences

- Rotation without downtime; refreshable tokens; single place to audit. − Key material still lives in host env; compromise of env = compromise of tokens (acceptable for internal MVP; managed KMS is a P2 hardening).

## Alternatives

Plain env var token (not refreshable) · managed secret manager API (host-dependent; can be added behind the same `TokenStore` interface).
