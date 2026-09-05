import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { AuthUser } from "./current-user.decorator";
import type { VerifiedToken } from "./supabase-jwt.service";

/** Lazy `user_profiles` upsert; reconciles invitation placeholders (created by email before first login) — FR-017, FR-033. */
@Injectable()
export class UserProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureProfile(t: VerifiedToken): Promise<AuthUser> {
    const email = t.email.toLowerCase();
    const byId = await this.prisma.userProfile.findUnique({ where: { id: t.sub } });
    if (byId) {
      const updated = await this.prisma.userProfile.update({
        where: { id: t.sub },
        data: {
          lastLoginAt: new Date(),
          ...(email && byId.email !== email ? { email } : {}),
          ...(t.name && !byId.displayName ? { displayName: t.name } : {}),
        },
      });
      return { id: updated.id, email: updated.email, displayName: updated.displayName };
    }
    const placeholder = email ? await this.prisma.userProfile.findUnique({ where: { email } }) : null;
    if (placeholder) {
      // Re-key placeholder to the auth user id; FKs cascade on update (project_members, audit_logs).
      const rekeyed = await this.prisma.userProfile.update({
        where: { id: placeholder.id },
        data: { id: t.sub, lastLoginAt: new Date(), displayName: placeholder.displayName ?? t.name },
      });
      return { id: rekeyed.id, email: rekeyed.email, displayName: rekeyed.displayName };
    }
    const created = await this.prisma.userProfile.create({
      data: { id: t.sub, email: email || `${t.sub}@unknown.local`, displayName: t.name, lastLoginAt: new Date() },
    });
    return { id: created.id, email: created.email, displayName: created.displayName };
  }
}
