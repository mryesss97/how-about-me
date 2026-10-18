import type { AppConfig } from "../../../config/config.module";
import { CryptoService } from "../../../common/crypto/crypto.service";
import type { PrismaService } from "../../../database/prisma.service";
import { ThreadsTokenStore } from "./threads-token.store";

type SecretRow = { connectionId: string; keyId: string; ciphertext: Uint8Array; iv: Uint8Array; authTag: Uint8Array };

function setup() {
  const secrets = new Map<string, SecretRow>();
  const prisma = {
    integrationSecret: {
      findUnique: jest.fn(({ where }: { where: { connectionId: string } }) =>
        Promise.resolve(secrets.get(where.connectionId) ?? null),
      ),
      create: jest.fn(({ data }: { data: SecretRow }) => {
        secrets.set(data.connectionId, data);
        return Promise.resolve(data);
      }),
      update: jest.fn(({ where, data }: { where: { connectionId: string }; data: SecretRow }) => {
        secrets.set(where.connectionId, { ...data, connectionId: where.connectionId });
        return Promise.resolve(data);
      }),
      deleteMany: jest.fn(({ where }: { where: { connectionId: string } }) => {
        secrets.delete(where.connectionId);
        return Promise.resolve({ count: 1 });
      }),
    },
    integrationConnection: {
      findUnique: jest.fn(() => Promise.resolve({ id: "conn-1", secret: secrets.get("conn-1") ?? null })),
    },
  };
  const crypto = new CryptoService({
    INTEGRATION_ENCRYPTION_KEYS: { k1: Buffer.alloc(32, 1).toString("base64") },
    INTEGRATION_ENCRYPTION_ACTIVE_KEY: "k1",
  } as unknown as AppConfig);
  const store = new ThreadsTokenStore(prisma as unknown as PrismaService, crypto);
  return { store, secrets };
}

const TOKEN = "THREADS-PLAINTEXT-TOKEN-0001";

describe("ThreadsTokenStore (FR-040, BR-036)", () => {
  it("round-trips save/read and stores only ciphertext", async () => {
    const { store, secrets } = setup();
    expect(await store.save("conn-1", TOKEN)).toEqual({ rotated: false });
    expect(Buffer.from(secrets.get("conn-1")?.ciphertext ?? []).toString("utf8")).not.toContain(TOKEN);
    expect(await store.read("p1")).toBe(TOKEN);
  });

  it("second save rotates", async () => {
    const { store } = setup();
    await store.save("conn-1", TOKEN);
    expect(await store.save("conn-1", `${TOKEN}-new`)).toEqual({ rotated: true });
    expect(await store.read("p1")).toBe(`${TOKEN}-new`);
  });

  it("read returns null when nothing is stored; purge removes it", async () => {
    const { store } = setup();
    expect(await store.read("p1")).toBeNull();
    await store.save("conn-1", TOKEN);
    await store.purge("conn-1");
    expect(await store.read("p1")).toBeNull();
  });
});
