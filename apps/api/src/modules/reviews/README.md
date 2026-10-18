# reviews module

Analyst overrides — T-142 (FR-191/192/193, BR-025). Contract: docs/02-architecture/05-api-contract.md §7.

- `POST /projects/:projectId/mentions/:mentionId/overrides` (admin · analyst) body `CreateOverrideBodySchema` → `201 Override`.
  Stores `override_value = { "value": … }`, `previous_value` = AI value of the current analysis (null if unanalysed),
  `analysis_id` = current analysis. An active override on the same field is revoked and replaced in the same tx.
  intents/topics are deduped; `[]` = no labels.
- `DELETE …/overrides/:overrideId` (admin · analyst) → `204`; keeps the row (`revoked_at/revoked_by`); already revoked → no-op.
- Post row lock (`FOR UPDATE`) serializes concurrent writes; leftover P2002 → `409 OVERRIDE_CONFLICT`.
- Audit `override.created` `{ field, before, after, reason }`, `override.revoked` `{ field, before }` (FR-200, no post text).
- Reads: `effective_post_analysis` / `effective_post_intents` / `effective_post_topics` views (doc 04 §5);
  `OverridesRepository.listForPost` feeds mention detail `overrides[]`.

Review queue — T-144 (FR-195, BR-040). Contract: docs/02-architecture/05-api-contract.md §7 "Reviews".

- `GET /projects/:projectId/reviews` (any member) — `reason?`, `status=unreviewed|reviewed`, keyset cursor, `count=true` → tab `counts`.
  Reasons: `uncertain` (effective relevance), `low_confidence` (AI overall < medium band of the run's policy), `failed` (latest run).
  Scope: BR-007 matches, effective relevance ≠ irrelevant (BR-016). SQL in `review-queue.repository.ts`.
- `POST …/reviews/mark-reviewed` (admin · analyst) `{ postIds ≤ 50 }` → `{ marked }`; sets `social_posts.reviewed_at/by`;
  other-project ids skipped; audit `review.marked` `{ count, postIds }` (skipped when 0).
- `ReviewQueueRepository` is exported; `findState(projectId, postId)` reuses the queue CTE for one post → mention detail `review` (#339).
- BR-040: reviewed while `reviewed_at` ≥ latest run `created_at` (`review-state.sql.ts`, also used by mentions `reviewStatus[]`).
