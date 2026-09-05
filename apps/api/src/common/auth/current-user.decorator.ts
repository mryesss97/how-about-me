import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { UserRole } from "@how-about-me/contracts";

export type AuthUser = { id: string; email: string; displayName: string | null };
export type ProjectContext = { projectId: string; role: UserRole };
export type AuthedRequest = {
  user?: AuthUser;
  project?: ProjectContext;
  id?: string;
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.user) throw new Error("CurrentUser used on a public route");
  return req.user;
});

export const ProjectCtx = createParamDecorator((_data: unknown, ctx: ExecutionContext): ProjectContext => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.project) throw new Error("ProjectCtx used outside a project-scoped route");
  return req.project;
});
