import { ApiError } from "@/lib/api/client";

/** Maps a query error to the `QueryState` error shape (envelope fields when available). */
export function toQueryError(err: unknown) {
  if (!err) return null;
  return err instanceof ApiError
    ? { code: err.code, message: err.message, requestId: err.requestId }
    : { message: "Unexpected response from the server." };
}
