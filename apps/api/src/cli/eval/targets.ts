/** v1 freeze-gate targets — docs/01-product/08-taxonomy-classification.md §11 (FR-118). */
export const EVAL_TARGETS = {
  relevanceAccuracy: 0.85,
  irrelevantRecall: 0.8,
  sentimentAccuracyVi: 0.75,
  intentMicroF1: 0.7,
  topicMicroF1: 0.7,
  safetyAgreement: 0.9,
  /** Zero `severe` false negatives on the severe subset (BR-018). */
  severeFalseNegatives: 0,
} as const;
