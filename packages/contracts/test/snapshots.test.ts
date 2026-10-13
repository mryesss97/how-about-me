import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  ANALYSIS_STATUSES,
  ANALYSIS_TRIGGERS,
  AnalysisSettingsSchema,
  AuditLogsPageSchema,
  ERROR_CODES,
  HealthReadyResponseSchema,
  INTEGRATION_STATUSES,
  JOB_STATUSES,
  JOB_TRIGGERS,
  MENTION_SORTS,
  MentionsPageSchema,
  OVERRIDE_FIELDS,
  QUERY_TYPES,
  QueryShareResponseSchema,
  SyncJobSchema,
  SystemStatusResponseSchema,
  TopicSentimentResponseSchema,
  USER_ROLES,
} from "../src/index.js";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

// Doc examples (docs/02-architecture/05-api-contract.md) must keep parsing — breaking changes go to /api/v2 (§14).
const cases: [string, z.ZodType][] = [
  ["mentions-page", MentionsPageSchema],
  ["sync-job", SyncJobSchema],
  ["system-status", SystemStatusResponseSchema],
  ["audit-page", AuditLogsPageSchema],
  ["health-ready", HealthReadyResponseSchema],
  ["query-share", QueryShareResponseSchema],
  ["topic-sentiment", TopicSentimentResponseSchema],
  ["analysis-settings", AnalysisSettingsSchema],
];

describe("doc example fixtures", () => {
  it.each(cases)("%s parses", (name, schema) => {
    expect(schema.parse(fixture(name))).toMatchSnapshot();
  });
});

describe("contract surface", () => {
  it("error codes and HTTP map", () => {
    expect(ERROR_CODES).toMatchSnapshot();
  });
  it("enums", () => {
    expect({
      ANALYSIS_STATUSES,
      ANALYSIS_TRIGGERS,
      INTEGRATION_STATUSES,
      JOB_STATUSES,
      JOB_TRIGGERS,
      MENTION_SORTS,
      OVERRIDE_FIELDS,
      QUERY_TYPES,
      USER_ROLES,
    }).toMatchSnapshot();
  });
});
