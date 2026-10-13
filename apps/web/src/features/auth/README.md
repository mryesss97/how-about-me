# features/auth (T-032)

Docs: `docs/02-architecture/03-frontend-design.md` §3.

- `login-form.tsx` — email/password (+ Google when `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`), generic error, `reason=expired` banner.
- `safe-next.ts` — sanitises the `next` redirect target.
- `auth-bridge.tsx` — registers bearer token getter and the deduped refresh-once handler on the API client.
- `sign-out.ts` / `use-sign-out.ts` — `signOut` + `queryClient.clear()` + `location.replace("/login")`.
- `use-me.ts` — `useMe()` (`GET /me`, parsed with `MeResponseSchema`).
- Related: `src/proxy.ts`, `src/lib/supabase/*`, `app/(app)/layout.tsx` guard, `app/(public)/auth/callback/route.ts`.
