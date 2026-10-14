import { Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  constructor() {
    super({ log: process.env.LOG_LEVEL === "trace" ? ["query", "warn", "error"] : ["warn", "error"] });
  }
  async onModuleInit() {
    await this.$connect();
  }
  /**
   * Disconnect last (#258). Nest runs onModuleDestroy → beforeApplicationShutdown → onApplicationShutdown;
   * services release DB locks in beforeApplicationShutdown, so disconnecting earlier would make Prisma
   * silently reconnect and leak one connection per closed app.
   */
  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
