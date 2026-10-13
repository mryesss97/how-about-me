import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

/** Request id assigned by pino-http (`req.id`, from `x-request-id` or generated) — used for audit rows (FR-200). */
export const RequestId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | null => {
  const id = ctx.switchToHttp().getRequest<{ id?: unknown }>().id;
  return typeof id === "string" ? id : id === undefined || id === null ? null : String(id);
});
