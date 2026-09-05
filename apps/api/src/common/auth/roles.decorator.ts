import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@how-about-me/contracts";
export const ROLES_KEY = "roles";
/** Roles allowed on a `/projects/:projectId/**` route. Membership of any role is required when omitted. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
