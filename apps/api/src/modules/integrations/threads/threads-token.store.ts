import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { CryptoService } from "../../../common/crypto/crypto.service";
import { PrismaService } from "../../../database/prisma.service";

/** Read/write access to a connection's provider token — the collector (T-052) depends on this, not on Prisma. */
export interface TokenStore {
  save(connectionId: string, token: string, tx?: Prisma.TransactionClient): Promise<{ rotated: boolean }>;
  read(projectId: string): Promise<string | null>;
  purge(connectionId: string, tx?: Prisma.TransactionClient): Promise<void>;
}

export const THREADS_TOKEN_STORE = Symbol("THREADS_TOKEN_STORE");

/**
 * The only reader of `integration_secrets` (FR-040, BR-036 — docs/02-architecture/08-security-secrets.md §4).
 * Tokens are AES-256-GCM encrypted with the connection id as AAD. Plaintext never leaves this class
 * except as the return value of `read`, and is never logged.
 */
@Injectable()
export class ThreadsTokenStore implements TokenStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async save(connectionId: string, token: string, tx?: Prisma.TransactionClient): Promise<{ rotated: boolean }> {
    const db = tx ?? this.prisma;
    const enc = this.crypto.encrypt(token, connectionId);
    const existing = await db.integrationSecret.findUnique({ where: { connectionId }, select: { id: true } });
    // Prisma `Bytes` wants a plain Uint8Array (Buffer is typed over ArrayBufferLike).
    const data = {
      keyId: enc.keyId,
      ciphertext: Uint8Array.from(enc.ciphertext),
      iv: Uint8Array.from(enc.iv),
      authTag: Uint8Array.from(enc.authTag),
    };
    if (existing) {
      await db.integrationSecret.update({ where: { connectionId }, data: { ...data, rotatedAt: new Date() } });
      return { rotated: true };
    }
    await db.integrationSecret.create({ data: { id: randomUUID(), connectionId, ...data } });
    return { rotated: false };
  }

  /** Decrypted token for the project's Threads connection, or `null` when none is stored. */
  async read(projectId: string): Promise<string | null> {
    const conn = await this.prisma.integrationConnection.findUnique({
      where: { projectId_platform: { projectId, platform: "threads" } },
      select: { id: true, secret: true },
    });
    if (!conn?.secret) return null;
    const { keyId, ciphertext, iv, authTag } = conn.secret;
    return this.crypto.decrypt(
      { keyId, ciphertext: Buffer.from(ciphertext), iv: Buffer.from(iv), authTag: Buffer.from(authTag) },
      conn.id,
    );
  }

  async purge(connectionId: string, tx?: Prisma.TransactionClient): Promise<void> {
    await (tx ?? this.prisma).integrationSecret.deleteMany({ where: { connectionId } });
  }
}
