import { Inject, Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { APP_CONFIG, type AppConfig } from "../../../config/config.module";

export type InviteFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number }>;

export const INVITE_FETCH = Symbol("INVITE_FETCH");
const TIMEOUT_MS = 5_000;

/**
 * Optional Supabase invite email (FR-033, docs/02-architecture/08-security-secrets.md).
 * Server-side only; the service-role key is never logged. Best-effort: never throws.
 */
@Injectable()
export class SupabaseInviteService {
  private readonly url?: string;
  private readonly key?: string;

  constructor(
    @Inject(APP_CONFIG) cfg: AppConfig,
    @Inject(INVITE_FETCH) private readonly fetchFn: InviteFetch,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SupabaseInviteService.name);
    this.url = cfg.SUPABASE_URL?.replace(/\/+$/, "");
    this.key = cfg.SUPABASE_SERVICE_ROLE_KEY || undefined;
  }

  isEnabled(): boolean {
    return Boolean(this.url && this.key);
  }

  /** Returns true when the invite was sent (or the user already exists in Supabase Auth). */
  async invite(email: string): Promise<boolean> {
    if (!this.url || !this.key) return false;
    try {
      const res = await this.fetchFn(`${this.url}/auth/v1/invite`, {
        method: "POST",
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // 422 = already registered in Supabase Auth → nothing to send, treat as success.
      if (res.ok || res.status === 422) return true;
      this.logger.warn({ status: res.status }, "supabase invite failed");
    } catch (err: unknown) {
      this.logger.warn({ errName: err instanceof Error ? err.name : "unknown" }, "supabase invite failed");
    }
    return false;
  }
}
