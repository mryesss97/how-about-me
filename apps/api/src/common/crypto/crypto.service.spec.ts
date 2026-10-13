import { randomBytes } from "node:crypto";
import type { AppConfig } from "../../config/config.module";
import { CryptoService, KEY_BYTES, parseKeyMap, type EncryptedPayload } from "./crypto.service";

const K1 = randomBytes(KEY_BYTES).toString("base64");
const K2 = randomBytes(KEY_BYTES).toString("base64");
const CONNECTION_ID = "0199325e-4d2a-7c31-9f07-2f6d0a8b1c44";
const TOKEN = "THQVJXQ-fake-long-lived-token-for-tests";

const service = (keys: Record<string, string>, active: string) =>
  new CryptoService({
    INTEGRATION_ENCRYPTION_KEYS: keys,
    INTEGRATION_ENCRYPTION_ACTIVE_KEY: active,
  } as AppConfig);

describe("CryptoService (FR-040, NFR-013, ADR-0012)", () => {
  const crypto = service({ k1: K1 }, "k1");

  it("round-trips a token and stamps the active key id", () => {
    const payload = crypto.encrypt(TOKEN, CONNECTION_ID);
    expect(payload.keyId).toBe("k1");
    expect(payload.iv).toHaveLength(12);
    expect(payload.authTag).toHaveLength(16);
    expect(crypto.decrypt(payload, CONNECTION_ID)).toBe(TOKEN);
  });

  it("never stores the plaintext in the ciphertext", () => {
    const payload = crypto.encrypt(TOKEN, CONNECTION_ID);
    expect(payload.ciphertext.toString("utf8")).not.toContain("THQVJXQ");
    expect(payload.ciphertext.toString("base64")).not.toContain(Buffer.from(TOKEN).toString("base64"));
  });

  it("produces a different ciphertext every time (random IV per record)", () => {
    const a = crypto.encrypt(TOKEN, CONNECTION_ID);
    const b = crypto.encrypt(TOKEN, CONNECTION_ID);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(crypto.decrypt(b, CONNECTION_ID)).toBe(TOKEN);
  });

  describe("tamper detection", () => {
    const flip = (buf: Buffer) => {
      const copy = Buffer.from(buf);
      copy[0] = (copy[0] ?? 0) ^ 0xff;
      return copy;
    };

    it.each<[string, (p: EncryptedPayload) => EncryptedPayload]>([
      ["ciphertext", (p) => ({ ...p, ciphertext: flip(p.ciphertext) })],
      ["iv", (p) => ({ ...p, iv: flip(p.iv) })],
      ["auth tag", (p) => ({ ...p, authTag: flip(p.authTag) })],
    ])("rejects a modified %s", (_name, mutate) => {
      const payload = crypto.encrypt(TOKEN, CONNECTION_ID);
      expect(() => crypto.decrypt(mutate(payload), CONNECTION_ID)).toThrow(/Unable to decrypt secret/);
    });

    it("rejects a ciphertext replayed onto another connection (AAD binding)", () => {
      const payload = crypto.encrypt(TOKEN, CONNECTION_ID);
      expect(() => crypto.decrypt(payload, "0199325e-4d2a-7c31-9f07-000000000000")).toThrow(/Unable to decrypt/);
    });

    it("never leaks the OpenSSL failure detail", () => {
      const payload = crypto.encrypt(TOKEN, CONNECTION_ID);
      try {
        crypto.decrypt({ ...payload, authTag: Buffer.alloc(16) }, CONNECTION_ID);
        throw new Error("expected decrypt to throw");
      } catch (e) {
        expect((e as Error).message).toBe("Unable to decrypt secret (key_id=k1)");
      }
    });
  });

  describe("key rotation (TC-INT-013)", () => {
    it("decrypts records written under an older key while writing new ones under the active key", () => {
      const before = service({ k1: K1 }, "k1");
      const legacy = before.encrypt(TOKEN, CONNECTION_ID);

      const after = service({ k1: K1, k2: K2 }, "k2");
      expect(after.decrypt(legacy, CONNECTION_ID)).toBe(TOKEN);
      expect(after.encrypt(TOKEN, CONNECTION_ID).keyId).toBe("k2");
    });

    it("rewrap re-encrypts under the active key and keeps the plaintext identical", () => {
      const legacy = service({ k1: K1 }, "k1").encrypt(TOKEN, CONNECTION_ID);
      const after = service({ k1: K1, k2: K2 }, "k2");

      const rewrapped = after.rewrap(legacy, CONNECTION_ID);
      if (!rewrapped) throw new Error("expected the legacy record to be rewrapped");
      expect(rewrapped.keyId).toBe("k2");
      expect(after.decrypt(rewrapped, CONNECTION_ID)).toBe(TOKEN);
    });

    it("rewrap is a no-op for a record already on the active key", () => {
      const current = crypto.encrypt(TOKEN, CONNECTION_ID);
      expect(crypto.needsRewrap(current.keyId)).toBe(false);
      expect(crypto.rewrap(current, CONNECTION_ID)).toBeNull();
    });

    it("fails loudly when the key a record names has been removed from the env", () => {
      const legacy = service({ k1: K1 }, "k1").encrypt(TOKEN, CONNECTION_ID);
      const withoutK1 = service({ k2: K2 }, "k2");
      expect(() => withoutK1.decrypt(legacy, CONNECTION_ID)).toThrow(/Encryption key "k1" is not configured/);
    });

    it("exposes key ids but never key material", () => {
      const both = service({ k1: K1, k2: K2 }, "k2");
      expect(both.knownKeyIds).toEqual(["k1", "k2"]);
      expect(JSON.stringify(both.knownKeyIds)).not.toContain(K1);
    });
  });

  it("refuses to encrypt when the active key is missing from the map", () => {
    expect(() => service({ k1: K1 }, "k9").encrypt(TOKEN, CONNECTION_ID)).toThrow(/not configured/);
  });
});

describe("parseKeyMap", () => {
  it("rejects a key that is not 32 bytes so a bad rotation fails at boot", () => {
    expect(() => parseKeyMap({ k1: randomBytes(16).toString("base64") })).toThrow(/must be 32 base64-encoded bytes/);
  });

  it("accepts an empty map (dev/test before integrations are configured)", () => {
    expect(parseKeyMap({}).size).toBe(0);
  });
});

describe("CryptoService.safeEquals", () => {
  it("compares in constant time without throwing on length mismatch", () => {
    expect(CryptoService.safeEquals("abc", "abc")).toBe(true);
    expect(CryptoService.safeEquals("abc", "abd")).toBe(false);
    expect(CryptoService.safeEquals("abc", "abcd")).toBe(false);
    expect(CryptoService.safeEquals("", "")).toBe(true);
  });
});
