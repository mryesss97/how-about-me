import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ProjectRoleGuard } from "./project-role.guard";
import { SupabaseJwtGuard } from "./supabase-jwt.guard";
import { SupabaseJwtService } from "./supabase-jwt.service";
import { UserProfilesService } from "./user-profiles.service";

@Global()
@Module({
  providers: [
    SupabaseJwtService,
    UserProfilesService,
    { provide: APP_GUARD, useClass: SupabaseJwtGuard },
    { provide: APP_GUARD, useClass: ProjectRoleGuard },
  ],
  exports: [SupabaseJwtService, UserProfilesService],
})
export class AuthCommonModule {}
