import { Injectable, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/** Validates params/query/body with a Zod schema from @how-about-me/contracts. Throws ZodError → 400 VALIDATION_ERROR. */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}
  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}

export const zod = <T>(schema: ZodType<T>) => new ZodValidationPipe(schema);
