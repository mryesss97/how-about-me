# ADR-0010 · Gitflow branching + conventional commits + semver

**Status:** Accepted · **Date:** 2026-09-05

## Context

Owner requested gitflow. Team is small with staging/production environments and periodic releases.

## Decision

Branches: `main` (production, tagged `vX.Y.Z`), `develop` (integration → staging), `feature/<issue>-<slug>`, `fix/<issue>-<slug>`, `release/vX.Y.Z`, `hotfix/vX.Y.Z+1`. PRs squash-merge into `develop`; releases merge `release/*` into `main` (merge commit + tag) and back into `develop`. Conventional commits enforced by commitlint; changelog generated. Branch protection: PR + CI + 1 review on `develop`, 1 review + CODEOWNERS on `main`.

## Consequences

- Clear staging/prod mapping; hotfix path; readable history. − Slight ceremony for a small team; mitigated by squash merges and automation.

## Alternatives

Trunk-based with feature flags (fewer branches but requires mature flagging; revisit post-MVP).
