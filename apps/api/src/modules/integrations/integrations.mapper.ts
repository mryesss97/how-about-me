import type { IntegrationConnection } from "@prisma/client";
import type { ThreadsIntegrationStatus } from "@how-about-me/contracts";

export type ConnectionRow = IntegrationConnection;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** Prisma row → contract DTO. No row yet = never configured → `disconnected` (FR-044). Never includes the secret. */
export function toThreadsStatus(row: ConnectionRow | null): ThreadsIntegrationStatus {
  if (!row)
    return {
      status: "disconnected",
      accountIdentifier: null,
      grantedScopes: [],
      tokenExpiresAt: null,
      lastVerifiedAt: null,
      lastSuccessAt: null,
      lastError: null,
    };
  return {
    status: row.status,
    accountIdentifier: row.accountIdentifier,
    grantedScopes: row.grantedScopes,
    tokenExpiresAt: iso(row.tokenExpiresAt),
    lastVerifiedAt: iso(row.lastVerifiedAt),
    lastSuccessAt: iso(row.lastSuccessAt),
    lastError: row.lastErrorCode
      ? {
          code: row.lastErrorCode,
          message: row.lastErrorMessage ?? "",
          at: (row.lastErrorAt ?? row.updatedAt).toISOString(),
        }
      : null,
  };
}
