import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { APP_CONFIG, type AppConfig } from "./config/config.module";

export async function createApp() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const cfg = app.get<AppConfig>(APP_CONFIG);
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api/v1", { exclude: ["health/live", "health/ready", "metrics"] });
  app.use(helmet());
  app.enableCors({
    origin: cfg.CORS_ORIGINS.split(",").map((s) => s.trim()),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type", "x-request-id"],
    exposedHeaders: ["x-request-id"],
  });
  app.enableShutdownHooks();

  if (cfg.SWAGGER_ENABLED && cfg.NODE_ENV !== "production") {
    const doc = new DocumentBuilder()
      .setTitle("How About Me API")
      .setDescription("Threads social listening — REST API v1")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, doc));
  }
  return { app, cfg };
}

async function bootstrap() {
  const { app, cfg } = await createApp();
  await app.listen(cfg.PORT);
  app
    .get(Logger)
    .log(`api listening on :${cfg.PORT} (role=${cfg.APP_ROLE}, env=${cfg.NODE_ENV}, providers=${cfg.PROVIDERS_MODE})`);
}

if (require.main === module) {
  bootstrap().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
