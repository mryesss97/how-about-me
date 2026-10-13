import pino from "pino";
import { buildRedactOptions } from "./logger.config";

/** TC-SYS-009 / NFR-014: secrets never reach log output. */
function capture() {
  const lines: string[] = [];
  const logger = pino({ redact: buildRedactOptions() }, { write: (l: string) => void lines.push(l) });
  return { logger, lines };
}

describe("logger redaction (TC-SYS-009, NFR-014)", () => {
  it.each([
    ["request authorization header", { req: { headers: { authorization: "Bearer SECRET-1" } } }],
    ["request cookie", { req: { headers: { cookie: "sb=SECRET-1" } } }],
    ["top-level-ish accessToken", { ctx: { accessToken: "SECRET-1" } }],
    ["provider token", { provider: { token: "SECRET-1" } }],
    ["axios error config header", { err: { config: { headers: { authorization: "Bearer SECRET-1" } } } }],
    ["nested headers", { upstream: { response: { headers: { authorization: "Bearer SECRET-1" } } } }],
    ["client secret", { oauth: { client_secret: "SECRET-1" } }],
    ["app secret", { threads: { appSecret: "SECRET-1" } }],
    ["service role key", { supabase: { serviceRoleKey: "SECRET-1" } }],
  ])("redacts %s", (_label, obj) => {
    const { logger, lines } = capture();
    logger.info(obj, "msg");
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("SECRET-1");
    expect(lines[0]).toContain("[REDACTED]");
    expect(() => JSON.parse(lines[0] as string)).not.toThrow();
  });
});
