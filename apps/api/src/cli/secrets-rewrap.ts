/**
 * `pnpm --filter @how-about-me/api secrets:rewrap [--dry-run]`
 *
 * Re-encrypts every `integration_secrets` row that still uses an older key under
 * `INTEGRATION_ENCRYPTION_ACTIVE_KEY` — ADR-0012, docs/02-architecture/08-security-secrets.md §4
 * (NFR-013, TC-INT-013).
 *
 * Rotation procedure: add the new key to `INTEGRATION_ENCRYPTION_KEYS` while keeping the old one,
 * point `INTEGRATION_ENCRYPTION_ACTIVE_KEY` at it, deploy, run this, then remove the old key.
 * Plaintext tokens exist only in this process's memory and are never logged.
 */
import { PrismaClient } from "@prisma/client";
import { CryptoService } from "../common/crypto/crypto.service";
import { loadEnv } from "../config/env.schema";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const cfg = loadEnv();
  const crypto = new CryptoService(cfg);
  const prisma = new PrismaClient();

  console.log(`secrets:rewrap — active key "${crypto.activeKeyId}", known keys [${crypto.knownKeyIds.join(", ")}]`);
  if (dryRun) console.log("dry run: no rows will be written");

  let rewrapped = 0;
  let skipped = 0;
  const failures: { connectionId: string; keyId: string; message: string }[] = [];

  try {
    const secrets = await prisma.integrationSecret.findMany({
      where: { keyId: { not: crypto.activeKeyId } },
      select: { id: true, connectionId: true, keyId: true, ciphertext: true, iv: true, authTag: true },
      orderBy: { createdAt: "asc" },
    });
    console.log(`${secrets.length} record(s) to rewrap`);

    for (const secret of secrets) {
      try {
        const next = crypto.rewrap(
          {
            keyId: secret.keyId,
            ciphertext: Buffer.from(secret.ciphertext),
            iv: Buffer.from(secret.iv),
            authTag: Buffer.from(secret.authTag),
          },
          secret.connectionId,
        );
        if (!next) {
          skipped++;
          continue;
        }
        if (!dryRun) {
          await prisma.integrationSecret.update({
            where: { id: secret.id },
            data: {
              keyId: next.keyId,
              ciphertext: toBytes(next.ciphertext),
              iv: toBytes(next.iv),
              authTag: toBytes(next.authTag),
              rotatedAt: new Date(),
            },
          });
        }
        rewrapped++;
        console.log(`  connection ${secret.connectionId}: ${secret.keyId} → ${next.keyId}`);
      } catch (e) {
        // Keep going: one unreadable record must not block rotating the rest.
        failures.push({
          connectionId: secret.connectionId,
          keyId: secret.keyId,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`done — rewrapped=${rewrapped} skipped=${skipped} failed=${failures.length}`);
  for (const f of failures) console.error(`  FAILED connection ${f.connectionId} (key_id=${f.keyId}): ${f.message}`);
  if (failures.length > 0) process.exitCode = 1;
}

/** Prisma's `Bytes` columns take a plain `Uint8Array`; `Buffer` is one but typed over `ArrayBufferLike`. */
function toBytes(buf: Buffer) {
  return Uint8Array.from(buf);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
