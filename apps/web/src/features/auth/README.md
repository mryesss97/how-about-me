# features/auth (T-032, T-033)

Docs: `docs/02-architecture/03-frontend-design.md` §3.

- `login-form.tsx` — email/password (+ Google when `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`), generic error, `reason=expired` banner, `reason=forbidden` banner (render only, #286).
- `safe-next.ts` — sanitises the `next` redirect target.
- `auth-bridge.tsx` — registers bearer token getter and the deduped refresh-once handler on the API client.
- `sign-out.ts` / `use-sign-out.ts` — `signOut` + `queryClient.clear()` + `location.replace("/login")`.
- `use-me.ts` — `useMe()` (`GET /me`, parsed with `MeResponseSchema`).
- `use-current-project.tsx` — `CurrentProjectProvider` + `useCurrentProject()` (`localStorage["ham.projectId"]`, fallback `projects[0]`).
- `use-role.ts` — `useRole(projectId?)` → `{ role, settings, hasRole }`.
- `route-roles.ts` — `ROUTE_ROLES` + `canAccess(path, role)`; shared by sidebar, settings tabs, page guards.
- `require-role.tsx` — `<RequireRole roles fallback?>`; actions use `fallback={null}` (e.g. listening-query actions: `roles={["admin"]}`).
- `require-project.tsx` — `<RequireProject>` in `(app)/layout.tsx`: zero memberships → `NoProjectState` instead of the page.
- `test-utils.tsx` — `/me` fixtures + providers for tests.
- Related: `src/proxy.ts`, `src/lib/supabase/*`, `app/(app)/layout.tsx` guard, `app/(public)/auth/callback/route.ts`.
