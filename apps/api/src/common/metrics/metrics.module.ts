import { Global, type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { HttpMetricsMiddleware } from "./http-metrics.middleware";
import { MetricsController } from "./metrics.controller";
import { MetricsLogFallback } from "./metrics-log.fallback";
import { MetricsService } from "./metrics.service";

/** FR-174: Prometheus registry, `/metrics`, HTTP instrumentation and the log fallback (doc 09 §2). */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, HttpMetricsMiddleware, MetricsLogFallback],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpMetricsMiddleware).forRoutes("{*splat}");
  }
}
