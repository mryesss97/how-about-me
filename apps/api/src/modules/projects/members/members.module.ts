import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module";
import { MembersController } from "./members.controller";
import { MembersRepository } from "./members.repository";
import { MembersService } from "./members.service";
import { INVITE_FETCH, type InviteFetch, SupabaseInviteService } from "./supabase-invite.service";

const nativeFetch: InviteFetch = (url, init) => fetch(url, init);

@Module({
  imports: [AuditModule],
  controllers: [MembersController],
  providers: [
    MembersService,
    MembersRepository,
    SupabaseInviteService,
    { provide: INVITE_FETCH, useValue: nativeFetch },
  ],
})
export class MembersModule {}
