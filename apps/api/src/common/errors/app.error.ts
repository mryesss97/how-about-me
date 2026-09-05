import { ERROR_CODES, type ErrorCode } from "@how-about-me/contracts";

/** Domain error carrying a stable code — docs/02-architecture/02-backend-design.md §5 */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly details?: unknown,
    status?: number,
  ) {
    super(message ?? code);
    this.name = "AppError";
    this.status = status ?? ERROR_CODES[code];
  }
  static notFound(what = "Resource") {
    return new AppError("NOT_FOUND", `${what} not found`);
  }
}
