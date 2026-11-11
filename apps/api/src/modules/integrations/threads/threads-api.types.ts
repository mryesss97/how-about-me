import { z } from "zod";

/**
 * Internal (non-contract) shapes of Threads responses. Items stay loose records: a broken item must reach
 * the normalizer to be counted as `invalid` (TC-COL-009), not fail the whole page.
 */
export const SearchResponseSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  paging: z
    .object({
      cursors: z.object({ after: z.string().optional() }).partial().optional(),
      next: z.string().optional(),
    })
    .partial()
    .optional(),
});

export const MeSchema = z.object({ id: z.string(), username: z.string().optional() });

export const DebugTokenSchema = z.object({
  data: z.object({
    is_valid: z.boolean().optional(),
    scopes: z.array(z.string()).optional(),
    expires_at: z.number().optional(),
  }),
});
