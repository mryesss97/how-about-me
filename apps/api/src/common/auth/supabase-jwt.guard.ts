import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppError } from "../errors/app.error";
import { IS_PUBLIC_KEY } from "./public.decorator";
import type { AuthedRequest } from "./current-user.decorator";
import { SupabaseJwtService } from "./supabase-jwt.service";
import { UserProfilesService } from "./user-profiles.service";

/** Global guard: verifies `Authorization: Bearer <JWT>` and attaches `req.user` (profile upserted lazily, FR-017). */
@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: SupabaseJwtService,
    private readonly profiles: UserProfilesService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers["authorization"];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw?.startsWith("Bearer ")) throw new AppError("AUTH_MISSING_TOKEN", "Missing bearer token");
    const verified = await this.jwt.verify(raw.slice(7).trim());
    req.user = await this.profiles.ensureProfile(verified);
    return true;
  }
}
