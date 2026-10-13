import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { AuthUser } from "./current-user.decorator";
import type { VerifiedToken } from "./supabase-jwt.service";

/** `last_login_at` is only rewritten when older than this, to avoid a DB write on every request (FR-017). */
export const LAST_LOGIN_THROTTLE_MS = 5 * 60_000;

type ProfileRow = { id: string; email: string; displayName: string | null; lastLoginAt: Date | null };

/** Prisma known-request error codes without importing `@prisma/client` outside the data layer. */
function prismaCode(e: unknown): string | undefined {
  if (e && typeof e === "object" && "code" in e && typeof e.code === "string") return e.code;
  return undefined;
}

const toAuthUser = (p: ProfileRow): AuthUser => ({ id: p.id, email: p.email, displayName: p.displayName });

/** Lazy `user_profiles` upsert; reconciles invitation placeholders (created by email before first login) — FR-017, FR-033. */
@Injectable()
export class UserProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureProfile(t: VerifiedToken): Promise<AuthUser> {
    try {
      return await this.upsert(t);
    } catch (e) {
      // Concurrent first-login requests race on create/rekey (P2002 unique, P2025 not found) → re-read once.
      const code = prismaCode(e);
      if (code !== "P2002" && code !== "P2025") throw e;
      const byId = await this.prisma.userProfile.findUnique({ where: { id: t.sub } });
      if (byId) return toAuthUser(byId);
      throw e;
    }
  }

  private async upsert(t: VerifiedToken): Promise<AuthUser> {
    const email = t.email.toLowerCase();
    const now = new Date();
    const byId = await this.prisma.userProfile.findUnique({ where: { id: t.sub } });
    if (byId) {
      const data = {
        ...(!byId.lastLoginAt || now.getTime() - byId.lastLoginAt.getTime() >= LAST_LOGIN_THROTTLE_MS
          ? { lastLoginAt: now }
          : {}),
        ...(email && byId.email !== email ? { email } : {}),
        ...(t.name && !byId.displayName ? { displayName: t.name } : {}),
      };
      if (Object.keys(data).length === 0) return toAuthUser(byId);
      return toAuthUser(await this.prisma.userProfile.update({ where: { id: t.sub }, data }));
    }
    const placeholder = email ? await this.prisma.userProfile.findUnique({ where: { email } }) : null;
    if (placeholder) {
      // Re-key placeholder to the auth user id; FKs cascade on update (project_members, audit_logs) — FR-033.
      const rekeyed = await this.prisma.userProfile.update({
        where: { id: placeholder.id },
        data: { id: t.sub, lastLoginAt: now, displayName: placeholder.displayName ?? t.name },
      });
      return toAuthUser(rekeyed);
    }
    const created = await this.prisma.userProfile.create({
      data: { id: t.sub, email: email || `${t.sub}@unknown.local`, displayName: t.name, lastLoginAt: now },
    });
    return toAuthUser(created);
  }
}
