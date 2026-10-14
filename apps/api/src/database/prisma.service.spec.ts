import { PrismaService } from "./prisma.service";

describe("PrismaService shutdown order (#258)", () => {
  it("disconnects in onApplicationShutdown, not onModuleDestroy", async () => {
    const svc = new PrismaService();
    const spy = jest.spyOn(svc, "$disconnect").mockResolvedValue(undefined);
    expect((svc as unknown as Record<string, unknown>).onModuleDestroy).toBeUndefined();
    await svc.onApplicationShutdown();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
