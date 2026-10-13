import { Injectable, type PipeTransform } from "@nestjs/common";
import { LISTENING_QUERY_IMMUTABLE_FIELDS } from "@how-about-me/contracts";
import { AppError } from "../../common/errors/app.error";

/**
 * FR-054 / BR-009: PATCH must reject queryValue/queryType with 400 QUERY_IMMUTABLE_FIELD.
 * Runs before the Zod pipe (which would otherwise strip those keys silently). Any presence of the key counts,
 * whatever its value.
 */
@Injectable()
export class RejectImmutableFieldsPipe implements PipeTransform<unknown, unknown> {
  transform(value: unknown): unknown {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    const fields = LISTENING_QUERY_IMMUTABLE_FIELDS.filter((f) => Object.hasOwn(value, f));
    if (fields.length > 0)
      throw new AppError(
        "QUERY_IMMUTABLE_FIELD",
        "queryValue and queryType are immutable — create a new query instead",
        { fields },
      );
    return value;
  }
}
