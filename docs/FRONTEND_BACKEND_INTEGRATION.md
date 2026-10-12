# Frontend ↔ Backend Integration — Session Log

Scope agreed with the user for this session: **core vertical slice only**
(API client + real authentication + one real data screen), not every
feature in the original 10-phase request. The rest is listed as backlog
at the end of this doc, not implemented.

## 0. Baseline (before this work)

- Branch `design-system-retrofit`, HEAD `144bc3d`, clean working tree.
- Lint: pass. Typecheck: pass. Tests: 27/27 pass. Build: pass, 19 routes.
- Zero HTTP calls anywhere in `src/` (confirmed via grep). Auth was
  `localStorage`-only, accepting any non-empty email/password
  (`src/lib/auth.ts`, pre-change).
- Backend (`TCO_Backend`, separate repo, Fastify + Prisma + Postgres + JWT)
  was not running; confirmed via `lsof` that no dev servers were up.

## 1. What was built

| Commit | Change |
|---|---|
| `370d3d0` | `src/lib/api/{env,session,client}.ts` + tests — typed `apiRequest()`: bearer auth header, `{data}`/`{error}` envelope unwrapping, `AbortController` timeout, deduplicated token-refresh-and-retry on 401 |
| `07efa4d` | `src/lib/auth.ts` rewritten to call real `POST /auth/login` / `POST /auth/logout` instead of accepting any credentials |
| `88d2cda` | Login page awaits the real call, shows the backend's actual error message, removes the stale "any email/password" demo banner |
| `89f69c2` | Dashboard's "Fleet Status & Health" panel wired to real `GET /locomotives` via `src/lib/api/locomotives.ts` + `src/hooks/use-locomotives.ts`, with loading/empty/error states |

Every commit above was preceded by `tsc --noEmit`, `eslint .`, and
`vitest run` passing (39/39 tests after the api/auth additions), and the
full suite was re-run clean after each step.

## 2. Environment configuration

- `NEXT_PUBLIC_API_BASE_URL` — the backend's **origin only** (e.g.
  `http://localhost:8000`), no `/api/v1` suffix. The versioned prefix is
  appended once in `src/lib/api/env.ts` so call sites stay agnostic of it.
- `.env.example` added (placeholder value only). `.env` added to
  `.gitignore` (it was previously untracked but not ignored — no secret
  was ever committed, confirmed by `git log` / `git status` before this
  change). `.env.local` (real dev value) was created locally and is
  already covered by the pre-existing `*.local` ignore pattern.

## 3. Authentication — what changed and why

`src/lib/auth.ts` now calls the backend for real:

- `login(email, password)` → `POST /api/v1/auth/login`. Throws `ApiError`
  with the backend's actual code/message on failure (e.g.
  `INVALID_CREDENTIALS`).
- `logout()` clears the local session **synchronously first**, then makes
  a best-effort `POST /api/v1/auth/logout` to revoke the refresh token.
  Local logout always succeeds even if the backend call fails.
- Tokens (access + refresh) are cached in `localStorage` alongside the
  session (`src/lib/api/session.ts`) — this is convenience storage, not
  access control. Every protected request is independently authorized by
  the backend validating the bearer token. `AuthGate.tsx`'s redirect logic
  is a UI convenience, not a security boundary — documented in-code.
- On a 401, `apiRequest()` attempts one token refresh (deduplicated across
  concurrent calls via a shared in-flight promise) and retries once; if
  the refresh also fails, the local session is cleared, which
  `AuthGate`'s `tco-auth-change` listener picks up and redirects to
  `/login`.
- No HttpOnly-cookie flow was introduced because `TCO_Backend` issues
  bearer tokens, not cookies — matching the backend's actual contract
  rather than inventing one it doesn't support.

## 4. Live verification performed (not just mocked tests)

Backend was started for real (`npx tsx watch src/app/server.ts` against
the existing local Postgres `tco_backend` DB, 6 migrations already
applied) and the frontend dev server (`next dev`) was pointed at it via
`.env.local`. Using real browser automation (not a simulated/mocked
flow):

1. Registered a real account via `POST /auth/register`.
2. Attempted login with a **wrong** password in the actual login form →
   backend returned `401 INVALID_CREDENTIALS`, UI showed "Invalid email
   or password" inline, stayed on `/login`. Confirmed via
   `read_network_requests`.
3. Logged in with the **correct** password → backend returned `200`,
   frontend redirected to `/`, `localStorage.tco_auth_session` contained
   the real JWT pair and user profile (verified via `javascript_tool`).
4. Seeded one real fleet and two real locomotives directly via the API
   (`POST /fleets`, `POST /locomotives`).
5. Reloaded the dashboard — the "Fleet Status & Health" panel rendered
   **exactly those two locomotives** (model, manufacturer, horsepower,
   status, health score), not synthetic data. Confirmed `GET
   /locomotives` returned `200` via `read_network_requests`.
6. Clicked "Sign out" → `POST /auth/logout` returned `200`,
   `localStorage` session cleared (confirmed `null`), redirected to
   `/login`.
7. Navigated directly to `/fleet-explorer` while logged out → redirected
   to `/login` (protected-route enforcement confirmed).

### Known environment instability during this session

Partway through verification, the shared local Postgres `tco_backend`
database was emptied by something outside this session (the `User` table
went from populated to 0 rows between two of my own requests, with no
destructive command issued by me — confirmed via direct `psql` query and
backend request logs showing no corresponding delete/reset call from this
session). The backend process also auto-restarted many times
(`tsx watch` picking up file changes in `TCO_Backend/src/...`) that this
session did not make. This points to **another process actively working
in `TCO_Backend` concurrently with this session** — plausibly a separate
agent/session on the same machine. I did not investigate or touch the
backend repo to find out, per this session's scope (frontend-only, no
backend changes). I re-seeded a fresh account and data each time this
happened and completed verification successfully; flagging it here so the
user isn't surprised if backend state looks different than expected.

## 5. Test results (this repo, after all changes)

```
Lint:        PASS (eslint .)
Typecheck:   PASS (tsc --noEmit)
Tests:       39/39 PASS (vitest run) — 27 pre-existing + 12 new
             (7 for src/lib/api/client.ts, 5 for src/lib/auth.ts)
Build:       PASS (next build, 19 routes + sitemap)
```

## 6. Feature → endpoint mapping (current state only)

| Feature | Backend endpoint | Status |
|---|---|---|
| Login | `POST /api/v1/auth/login` | **Connected, verified live** |
| Logout | `POST /api/v1/auth/logout` | **Connected, verified live** |
| Token refresh | `POST /api/v1/auth/refresh` | Connected, covered by unit tests (401→refresh→retry); not separately exercised live in-browser this session |
| Dashboard "Fleet Status & Health" | `GET /api/v1/locomotives` | **Connected, verified live** |
| Everything else (fleet-explorer, BOM, simulation, scenarios, monte-carlo, maintenance, reliability, asset-health, benchmark, tender, integrations, library, glossary, configure, sustainability, and the rest of the dashboard — KPI tiles, cost timeline, part-level table) | various, see `TCO_Backend/docs/openapi` or `GET /openapi.json` | **Not connected — still synthetic/local, unchanged this session** |

## 7. Remaining work (not attempted this session, by agreement with the user)

The original request specified 10 phases covering every route, full UI
design-system stabilization, deployment reconciliation, and three
documentation files. Only the auth + API-client + one-screen slice above
was built. Not done, in priority order:

1. Wire remaining read-heavy screens (fleet-explorer, asset-health,
   maintenance, reliability) to their respective backend endpoints.
2. Decide and document whether TCO/simulation math should be backend
   canonical (`POST /tco/runs`, `POST /simulation-runs`) or an
   intentional client-side preview — do not silently keep both diverging.
3. Scenarios CRUD against `/api/v1/scenarios`.
4. Monte Carlo: replace the hardcoded `MONTE_CARLO_RESULTS` dataset with
   real `/api/v1/simulation-runs` calls.
5. Typography/spacing/theme/logo/responsive UI pass (Phase 1 of the
   original request) — not started.
6. Reconcile the three git remotes (`origin`, `sahay`, `wayam`) — not
   investigated.
7. Production deployment verification — not investigated; the backend's
   own prior audit notes `tco.wayam.ai` was last observed serving an
   older Vite build, unrelated to this Next.js repo.

## 8. Commit hashes (this session, chronological)

```
370d3d0 feat(api): add typed API client with auth header, timeout, and token refresh
07efa4d feat(auth): replace demo auth with real backend login/logout
88d2cda feat(login): call real login/logout, show backend error, remove demo banner
89f69c2 feat(dashboard): connect Fleet Status panel to real GET /locomotives
```

All committed individually to `design-system-retrofit`, no squashing, no
force-push, no backend-repo changes.
