"use client";

import {
  AddMemberBodySchema,
  MemberListResponseSchema,
  MemberSchema,
  ProjectSchema,
  UpdateMemberBodySchema,
  UpdateProjectBodySchema,
  type AddMemberBody,
  type Member,
  type Project,
  type UpdateProjectBody,
  type UserRole,
} from "@how-about-me/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessageVi } from "@/lib/semantics/api-errors";
import { ApiError, apiFetch } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";

/** User-facing message for a mutation error; unknown codes keep the server message plus requestId. */
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Đã có lỗi xảy ra. Vui lòng thử lại.";
  switch (err.code) {
    case "LAST_ADMIN":
      return "Dự án phải còn ít nhất một quản trị viên.";
    case "MEMBER_EXISTS":
      return "Email này đã là thành viên.";
    case "FORBIDDEN_ROLE":
    case "FORBIDDEN_PROJECT":
      return "Bạn không có quyền thực hiện thao tác này.";
    default:
      return err.requestId ? `${apiErrorMessageVi(err)} (Mã yêu cầu: ${err.requestId})` : apiErrorMessageVi(err);
  }
}

export function useProject(pid: string) {
  return useQuery({
    queryKey: qk.project(pid),
    queryFn: async () => ProjectSchema.parse(await apiFetch<unknown>(`/projects/${pid}`)),
  });
}

/** FR-032: PATCH only the changed fields; `/me` carries name/timezone/settings so it is refreshed too. */
export function useUpdateProject(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateProjectBody) =>
      ProjectSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}`, {
          method: "PATCH",
          body: JSON.stringify(UpdateProjectBodySchema.parse(body)),
        }),
      ),
    onSuccess: (project: Project, body) => {
      qc.setQueryData(qk.project(pid), project);
      void qc.invalidateQueries({ queryKey: qk.me() });
      // Analytics buckets depend on the project timezone (metric definitions).
      if (body.timezone) void qc.invalidateQueries({ queryKey: ["project", pid, "analytics"] });
      // FR-148 / #251: the phrases query key does not carry the threshold, so refetch the bubble map's phrases.
      else if (body.settings?.phraseMinMentions !== undefined)
        void qc.invalidateQueries({ queryKey: ["project", pid, "analytics", "phrases"] });
      // FR-149 / #261: landing balloons read the configured terms server-side (not in the key).
      if (!body.timezone && body.settings?.landingTerms !== undefined)
        void qc.invalidateQueries({ queryKey: ["project", pid, "analytics", "landing-terms"] });
    },
  });
}

export function useMembers(pid: string) {
  return useQuery({
    queryKey: qk.members(pid),
    queryFn: async () => MemberListResponseSchema.parse(await apiFetch<unknown>(`/projects/${pid}/members`)),
  });
}

/** Refetch members; refresh `/me` too when the caller changed their own membership. */
function useInvalidateMembers(pid: string, currentUserId?: string) {
  const qc = useQueryClient();
  return (userId?: string) => {
    void qc.invalidateQueries({ queryKey: qk.members(pid) });
    if (userId && userId === currentUserId) void qc.invalidateQueries({ queryKey: qk.me() });
  };
}

/** FR-033 */
export function useAddMember(pid: string) {
  const invalidate = useInvalidateMembers(pid);
  return useMutation({
    mutationFn: async (body: AddMemberBody): Promise<Member> =>
      MemberSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/members`, {
          method: "POST",
          body: JSON.stringify(AddMemberBodySchema.parse(body)),
        }),
      ),
    onSettled: () => invalidate(),
  });
}

/** FR-034, FR-035 (`409 LAST_ADMIN`). */
export function useUpdateMemberRole(pid: string, currentUserId?: string) {
  const invalidate = useInvalidateMembers(pid, currentUserId);
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }): Promise<Member> =>
      MemberSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/members/${userId}`, {
          method: "PATCH",
          body: JSON.stringify(UpdateMemberBodySchema.parse({ role })),
        }),
      ),
    onSettled: (_d, _e, vars) => invalidate(vars.userId),
  });
}

/** FR-034, FR-035 (`409 LAST_ADMIN`). */
export function useRemoveMember(pid: string, currentUserId?: string) {
  const invalidate = useInvalidateMembers(pid, currentUserId);
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiFetch<void>(`/projects/${pid}/members/${userId}`, { method: "DELETE" });
    },
    onSettled: (_d, _e, userId) => invalidate(userId),
  });
}
