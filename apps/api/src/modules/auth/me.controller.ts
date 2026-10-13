import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { MeResponse } from "@how-about-me/contracts";
import { CurrentUser, type AuthUser } from "../../common/auth/current-user.decorator";
import { MeRepository } from "./me.repository";

/** `GET /api/v1/me` — docs/02-architecture/05-api-contract.md §2 */
@ApiTags("auth")
@ApiBearerAuth()
@Controller("me")
export class MeController {
  constructor(private readonly repo: MeRepository) {}

  @Get()
  async me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    const projects = await this.repo.listActiveProjects(user.id);
    return { id: user.id, email: user.email, displayName: user.displayName, projects };
  }
}
