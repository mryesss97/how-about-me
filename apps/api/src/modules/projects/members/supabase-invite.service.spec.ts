import type { PinoLogger } from "nestjs-pino";
import type { AppConfig } from "../../../config/config.module";
import { type InviteFetch, SupabaseInviteService } from "./supabase-invite.service";

const KEY = "service-role-secret-key";
function setup(cfg: Partial<AppConfig>, fetchImpl?: jest.Mock) {
  const fetchFn = fetchImpl ?? jest.fn().mockResolvedValue({ ok: true, status: 200 });
  const logger = { setContext: jest.fn(), warn: jest.fn() };
  const svc = new SupabaseInviteService(
    cfg as AppConfig,
    fetchFn as unknown as InviteFetch,
    logger as unknown as PinoLogger,
  );
  return { svc, fetchFn, logger };
}

/** FR-033 optional invite email via Supabase service-role (server-side only). */
describe("SupabaseInviteService", () => {
  it("disabled without SUPABASE_URL or service-role key", async () => {
    for (const cfg of [{ SUPABASE_URL: "https://x.supabase.co" }, { SUPABASE_SERVICE_ROLE_KEY: KEY }]) {
      const { svc, fetchFn } = setup(cfg);
      expect(svc.isEnabled()).toBe(false);
      expect(await svc.invite("a@example.com")).toBe(false);
      expect(fetchFn).not.toHaveBeenCalled();
    }
  });

  it("POSTs /auth/v1/invite with service-role headers", async () => {
    const { svc, fetchFn } = setup({ SUPABASE_URL: "https://x.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: KEY });
    expect(svc.isEnabled()).toBe(true);
    expect(await svc.invite("a@example.com")).toBe(true);
    const [url, init] = fetchFn.mock.calls[0] as Parameters<InviteFetch>;
    expect(url).toBe("https://x.supabase.co/auth/v1/invite");
    expect(init.headers).toMatchObject({ apikey: KEY, Authorization: `Bearer ${KEY}` });
    expect(JSON.parse(init.body)).toEqual({ email: "a@example.com" });
  });

  it("422 already registered counts as success", async () => {
    const { svc } = setup(
      { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: KEY },
      jest.fn().mockResolvedValue({ ok: false, status: 422 }),
    );
    expect(await svc.invite("a@example.com")).toBe(true);
  });

  it("failures are logged at warn without the key and never throw", async () => {
    for (const impl of [
      jest.fn().mockResolvedValue({ ok: false, status: 500 }),
      jest.fn().mockRejectedValue(new Error(KEY)),
    ]) {
      const { svc, logger } = setup({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: KEY }, impl);
      expect(await svc.invite("a@example.com")).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(KEY);
    }
  });
});
