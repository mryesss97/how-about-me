import { Global, Module } from "@nestjs/common";
import { loadEnv, type Env } from "./env.schema";

export const APP_CONFIG = Symbol("APP_CONFIG");
export type AppConfig = Env;

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadEnv() }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
