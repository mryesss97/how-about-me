import { v7 as uuidv7 } from "uuid";

/** Client-supplied ids are accepted only when they are short and log/header safe (no CR/LF, spaces, quotes). */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

/** Returns the incoming `x-request-id` when safe, otherwise a fresh uuid v7 — docs/02-architecture/02-backend-design.md §4 */
export function resolveRequestId(header: unknown): string {
  return typeof header === "string" && REQUEST_ID_PATTERN.test(header) ? header : uuidv7();
}
