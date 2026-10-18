/**
 * Where the collector gets the Threads access token for a project (T-052). The real implementation reads
 * `integration_secrets` (AES-GCM) and lands with T-038/T-039; the token never leaves the API process and is
 * never logged.
 */
export interface ThreadsTokenSource {
  getAccessToken(projectId: string): Promise<string>;
}

export const THREADS_TOKEN_SOURCE = Symbol("THREADS_TOKEN_SOURCE");

/** `PROVIDERS_MODE=fake`: the fake provider ignores the token. */
export class FakeThreadsTokenSource implements ThreadsTokenSource {
  async getAccessToken(_projectId: string): Promise<string> {
    return "fake-token";
  }
}
