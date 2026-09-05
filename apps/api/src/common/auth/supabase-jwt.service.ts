import { Inject, Injectable } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, errors as joseErrors, type JWTPayload } from "jose";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { AppError } from "../errors/app.error";

export type VerifiedToken = { sub: string; email: string; name: string | null; payload: JWTPayload };

/** Verifies Supabase access tokens via JWKS (preferred) or HS256 secret — docs/02-architecture/08-security-secrets.md §2 */
@Injectable()
export class SupabaseJwtService {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;
  private readonly hsSecret?: Uint8Array;

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {
    const secret = cfg.SUPABASE_JWT_SECRET ?? (cfg.NODE_ENV === "test" ? cfg.AUTH_TEST_JWT_SECRET : undefined);
    if (secret) this.hsSecret = new TextEncoder().encode(secret);
    const jwksUrl =
      cfg.SUPABASE_JWKS_URL ??
      (cfg.SUPABASE_URL ? `${cfg.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json` : undefined);
    if (jwksUrl) this.jwks = createRemoteJWKSet(new URL(jwksUrl), { cooldownDuration: 30_000, cacheMaxAge: 600_000 });
  }

  async verify(token: string): Promise<VerifiedToken> {
    try {
      const options = { audience: "authenticated", clockTolerance: 5 } as const;
      const { payload } = this.jwks
        ? await jwtVerify(token, this.jwks, options).catch(async (e) => {
            if (this.hsSecret && e instanceof joseErrors.JOSEError && !(e instanceof joseErrors.JWTExpired))
              return jwtVerify(token, this.hsSecret, options);
            throw e;
          })
        : this.hsSecret
          ? await jwtVerify(token, this.hsSecret, options)
          : (() => {
              throw new AppError("INTERNAL", "No JWT verification method configured");
            })();
      if (!payload.sub) throw new AppError("AUTH_INVALID_TOKEN", "Token has no subject");
      const email = typeof payload["email"] === "string" ? payload["email"] : "";
      const meta = (payload["user_metadata"] ?? {}) as Record<string, unknown>;
      const name =
        typeof meta["full_name"] === "string"
          ? meta["full_name"]
          : typeof meta["name"] === "string"
            ? meta["name"]
            : null;
      return { sub: payload.sub, email, name, payload };
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (e instanceof joseErrors.JWTExpired) throw new AppError("AUTH_TOKEN_EXPIRED", "Access token expired");
      throw new AppError("AUTH_INVALID_TOKEN", "Invalid access token");
    }
  }
}
