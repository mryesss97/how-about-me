import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { AppError } from "../errors/app.error";
import type { AuthedRequest } from "./current-user.decorator";
import { SupabaseJwtGuard } from "./supabase-jwt.guard";
import type { SupabaseJwtService } from "./supabase-jwt.service";
import type { UserProfilesService } from "./user-profiles.service";

const user = { id: "u1", email: "a@x.com", displayName: null };

function setup(isPublic: boolean) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(isPublic) } as unknown as Reflector;
  const verify = jest.fn().mockResolvedValue({ sub: "u1", email: "a@x.com", name: null, payload: {} });
  const ensureProfile = jest.fn().mockResolvedValue(user);
  const guard = new SupabaseJwtGuard(
    reflector,
    { verify } as unknown as SupabaseJwtService,
    { ensureProfile } as unknown as UserProfilesService,
  );
  const ctx = (req: AuthedRequest) =>
    ({
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;
  return { guard, verify, ctx };
}

const req = (authorization?: string): AuthedRequest => ({ headers: { authorization }, params: {} });

describe("SupabaseJwtGuard (FR-013)", () => {
  it("skips @Public() routes", async () => {
    const { guard, verify, ctx } = setup(true);
    await expect(guard.canActivate(ctx(req()))).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "Basic abc", "Bearer ", "Bearer    "])("TC-AUTH-005: %p → AUTH_MISSING_TOKEN", async (h) => {
    const { guard, ctx } = setup(false);
    const err = await guard.canActivate(ctx(req(h))).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("AUTH_MISSING_TOKEN");
  });

  it.each(["Bearer tok", "bearer tok", "BEARER  tok "])("valid header %p → req.user attached", async (h) => {
    const { guard, verify, ctx } = setup(false);
    const r = req(h);
    await expect(guard.canActivate(ctx(r))).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith("tok");
    expect(r.user).toEqual(user);
  });
});
