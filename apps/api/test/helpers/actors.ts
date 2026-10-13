import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { UserRole } from "@how-about-me/contracts";
import type { PrismaService } from "../../src/database/prisma.service";
import { mintTestJwt } from "./auth";
import { addMember, createUser } from "./factories";

/** Creates a user, optionally a project membership, and a signed test JWT (T-014). */
export async function createActor(prisma: PrismaService, opts: { projectId?: string; role?: UserRole } = {}) {
  const user = await createUser(prisma);
  if (opts.projectId && opts.role)
    await addMember(prisma, { projectId: opts.projectId, userId: user.id, role: opts.role });
  const token = await mintTestJwt({ sub: user.id, email: user.email });
  return { user, token };
}

/** Supertest wrapper: `/api/v1` prefix plus bearer token. */
export function api(app: INestApplication, token: string) {
  const agent = request(app.getHttpServer());
  const auth = (req: request.Test) => req.set("authorization", `Bearer ${token}`);
  return {
    get: (path: string) => auth(agent.get(`/api/v1${path}`)),
    post: (path: string, body?: object) => auth(agent.post(`/api/v1${path}`)).send(body ?? {}),
    patch: (path: string, body?: object) => auth(agent.patch(`/api/v1${path}`)).send(body ?? {}),
    put: (path: string, body?: object) => auth(agent.put(`/api/v1${path}`)).send(body ?? {}),
    delete: (path: string) => auth(agent.delete(`/api/v1${path}`)),
  };
}
