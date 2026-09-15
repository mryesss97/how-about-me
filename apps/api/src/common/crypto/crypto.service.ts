import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { AppError } from "../errors/app.error";

/**
 * AES-256-GCM envelope encryption for provider tokens — ADR-0012 ·
 * docs/02-architecture/08-security-secrets.md §4 (FR-040, NFR-013).
 *
 * Keys come from `INTEGRATION_ENCRYPTION_KEYS` (`{ "k1": "<base64 32 bytes>" }`) with
 * `INTEGRATION_ENCRYPTION_ACTIVE_KEY` naming the one used for new writes. Every record stores its
 * own `key_id` and random 12-byte IV, so a new key can be added and rolled forward by
 * `pnpm --filter @how-about-me/api secrets:rewrap` without downtime.
 *
 * The AAD is the `connection_id`: a ciphertext copied onto another connection's row fails to
 * decrypt instead of silently authenticating as that connection.
 */
export const ALGORITHM = "aes-256-gcm";
export const IV_BYTES = 12;
export const KEY_BYTES = 32;
export const AUTH_TAG_BYTES = 16;

/** Column shape of `integration_secrets` (minus the row metadata). */
export type EncryptedPayload = { keyId: string; ciphertext: Buffer; iv: Buffer; authTag: Buffer };

@Injectable()
export class CryptoService {
  private readonly keys: Map<string, Buffer>;
  readonly activeKeyId: string;

  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    this.keys = parseKeyMap(cfg.INTEGRATION_ENCRYPTION_KEYS);
    this.activeKeyId = cfg.INTEGRATION_ENCRYPTION_ACTIVE_KEY;
  }

  /** Key ids available for decryption — used by the rewrap CLI and System Status (never the key material). */
  get knownKeyIds(): string[] {
    return [...this.keys.keys()];
  }

  /** True when a stored record was written under an older key and should be rewrapped. */
  needsRewrap(keyId: string): boolean {
    return keyId !== this.activeKeyId;
  }

  /** Encrypts under the active key. `aad` is the owning `connection_id`. */
  encrypt(plaintext: string, aad: string): EncryptedPayload {
    const key = this.keyOrThrow(this.activeKeyId);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
    cipher.setAAD(Buffer.from(aad, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return { keyId: this.activeKeyId, ciphertext, iv, authTag: cipher.getAuthTag() };
  }

  /**
   * Decrypts a record with the key it names. Any tampering (ciphertext, IV, auth tag or a different
   * `connection_id` as AAD) fails the GCM check and raises a generic error — never the underlying
   * OpenSSL message, which would tell an attacker which part they got wrong.
   */
  decrypt(payload: EncryptedPayload, aad: string): string {
    const key = this.keyOrThrow(payload.keyId);
    try {
      const decipher = createDecipheriv(ALGORITHM, key, payload.iv, { authTagLength: AUTH_TAG_BYTES });
      decipher.setAAD(Buffer.from(aad, "utf8"));
      decipher.setAuthTag(payload.authTag);
      return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]).toString("utf8");
    } catch {
      throw new AppError("INTERNAL", `Unable to decrypt secret (key_id=${payload.keyId})`);
    }
  }

  /** Re-encrypts an existing record under the active key; returns `null` when it is already current. */
  rewrap(payload: EncryptedPayload, aad: string): EncryptedPayload | null {
    if (!this.needsRewrap(payload.keyId)) return null;
    return this.encrypt(this.decrypt(payload, aad), aad);
  }

  /** Constant-time comparison for the metrics/ops tokens that are compared, not decrypted. */
  static safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }

  private keyOrThrow(keyId: string): Buffer {
    const key = this.keys.get(keyId);
    if (!key)
      throw new AppError(
        "INTEGRATION_NOT_CONFIGURED",
        `Encryption key "${keyId}" is not configured — check INTEGRATION_ENCRYPTION_KEYS`,
      );
    return key;
  }
}

/** Validates every configured key eagerly so a bad rotation fails at boot, not on the next token write. */
export function parseKeyMap(raw: Record<string, string>): Map<string, Buffer> {
  const keys = new Map<string, Buffer>();
  for (const [keyId, encoded] of Object.entries(raw)) {
    const key = Buffer.from(encoded, "base64");
    if (key.length !== KEY_BYTES)
      throw new Error(
        `INTEGRATION_ENCRYPTION_KEYS["${keyId}"] must be ${KEY_BYTES} base64-encoded bytes (got ${key.length})`,
      );
    keys.set(keyId, key);
  }
  return keys;
}
