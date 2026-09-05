import { z } from "zod";
import { IsoDateTimeSchema, LastErrorSchema } from "./common.js";
import { IntegrationStatusSchema } from "./enums.js";

export const ThreadsIntegrationStatusSchema = z.object({
  status: IntegrationStatusSchema,
  accountIdentifier: z.string().nullable(),
  grantedScopes: z.array(z.string()),
  tokenExpiresAt: IsoDateTimeSchema.nullable(),
  lastVerifiedAt: IsoDateTimeSchema.nullable(),
  lastSuccessAt: IsoDateTimeSchema.nullable(),
  lastError: LastErrorSchema,
});
export type ThreadsIntegrationStatus = z.infer<typeof ThreadsIntegrationStatusSchema>;

/** Token is write-only: never appears in any response schema. */
export const PutThreadsIntegrationBodySchema = z.object({
  accessToken: z.string().min(20).max(4096),
  accountIdentifier: z.string().max(200).optional(),
  tokenExpiresAt: IsoDateTimeSchema.optional(),
});
export type PutThreadsIntegrationBody = z.infer<typeof PutThreadsIntegrationBodySchema>;
