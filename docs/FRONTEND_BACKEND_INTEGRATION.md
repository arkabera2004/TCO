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

### 4a. Fleet Explorer / BOM session — browser-verified live

Started `TCO_Backend` locally (Fastify on :8000, Postgres via `pg_isready`)
and `npm run dev` (Next.js on :3000), registered a fresh ADMIN test account
via `POST /auth/register`, and seeded a fleet + locomotive (ES44AC) via
curl using the exact payload shapes the frontend sends. Then, in-browser:

1. Logged in with the seeded test account — succeeded.
2. `/fleet-explorer` rendered the real locomotive, its real System → Assembly
   → Component chain (Engine → Exhaust Path → Turbocharger, seeded via
   curl), and clicking the component node showed the exact real field
   values ($10,000 purchase / $12,000 replace / 8yr life / 20k MTBF / 8h
   MTTR, 100% health and reliability since `currentHours: 0`).
3. `/bom` → "Live Locomotive BOM" view rendered the same real tree, with
   the other three views correctly labeled "(reference data)."
4. Used the in-page "Add System" form to create a "Traction" system —
   appeared immediately, and **survived a full page reload**, confirming
   it round-trips through the real backend rather than local state.
5. Logged out — redirected to `/login`; then navigating directly to `/bom`
   while signed out redirected back to `/login` (protected-route guard
   works).
6. Via curl: confirmed `DELETE /components/:id` soft-deletes the component
   (200, excluded from a subsequent `GET .../components`).
7. Browser console showed no errors during the walkthrough.

Not exercised in-browser this pass: the component create/delete buttons
inside the UI itself (verified against the live backend via curl instead —
see step 6), and the 403 path for a non-ADMIN/MANAGER role (no second test
account with a restricted role was created). Both servers were stopped and
the registered test account's data remains in the local dev database
(harmless — a local-only Postgres instance, not shared/production).

## 5. Test results (this repo, after all changes)

```
Lint:        PASS (eslint .)
Typecheck:   PASS (tsc --noEmit)
Tests:       51/51 PASS (vitest run) — 39 from the prior session + 12 new
             this session (locomotives, systems, assemblies, components
             API modules)
Build:       PASS (next build, 19 routes + sitemap)
```

## 6. Feature → endpoint mapping (current state only)

| Feature | Backend endpoint | Status |
|---|---|---|
| Login | `POST /api/v1/auth/login` | **Connected, verified live** |
| Logout | `POST /api/v1/auth/logout` | **Connected, verified live** |
| Token refresh | `POST /api/v1/auth/refresh` | Connected, covered by unit tests (401→refresh→retry); not separately exercised live in-browser this session |
| Dashboard "Fleet Status & Health" | `GET /api/v1/locomotives` | **Connected, verified live** |
| Fleet Explorer (radial hierarchy) | `GET /api/v1/locomotives`, `GET /api/v1/locomotives/:id` | **Connected, verified live** (see §4a). RUL is a client-side estimate (`lifeYears - currentHours/8760`), not a backend-persisted figure. |
| BOM — "Live Locomotive BOM" view | `GET /api/v1/locomotives/:id`, `POST .../systems`, `POST .../systems/:id/assemblies`, `POST/DELETE /api/v1/components`, `POST /api/v1/locomotives/:id/components` | **Connected, verified live** (see §4a) for System/Assembly/Component read + create, and Component delete. System/Assembly have **no edit or delete** — the backend doesn't expose those operations (only nested create + read via the locomotive tree), so none is built. Component create uses fleet-typical defaults for engineering fields (MTBF, Weibull β/η, warranty, labor %, downtime cost) rather than a full form — `PATCH /api/v1/components/:id` exists but has no edit UI yet. |
| BOM — 5-Level Hierarchy Tree / Inventory & Criticality / Depreciation & Capital views | none — these operate on a `Part` sub-level (below Component) that **does not exist in the backend's Prisma schema** | **Static reference data, now labeled as such in the view switcher.** Not rewired this session — see §7. |
| Everything else (simulation, scenarios, monte-carlo, maintenance, reliability, asset-health, benchmark, tender, integrations, library, glossary, configure, sustainability, and the rest of the dashboard — KPI tiles, cost timeline, part-level table) | various, see `TCO_Backend/docs/openapi` or `GET /openapi.json` | **Not connected — still synthetic/local, out of scope this session** |

## 6a. Why BOM's Part level stayed static

The backend's asset hierarchy (`TCO_Backend/prisma/schema.prisma`) stops at
`Locomotive → System → Assembly → Component` — there is no `Part` model, no
inventory fields (on-hand qty, reorder point, safety stock, ABC/VED class),
no reman/procurement pricing, and no part-level warranty-km tracking. The
BOM page's "5-Level Hierarchy Tree," "Inventory & Criticality," and
"Depreciation & Capital" views are built entirely around that missing Part
level (`src/data/bomData.ts` + `src/store/partsStore.ts`, both local/synthetic).
Rewiring them would mean fabricating a backend capability that doesn't
exist, which the integration mandate explicitly disallows. They're kept as
reference data, now labeled "(reference data)" in the view switcher, while a
new "Live Locomotive BOM" view handles everything the backend actually
supports at the Component level and above.

## 7. Remaining work (not attempted this session, by agreement with the user)

The original request specified 10 phases covering every route, full UI
design-system stabilization, deployment reconciliation, and three
documentation files. This session additionally connected Fleet Explorer and
BOM's Component-and-above layer (see §6). Not done, in priority order:

1. Wire remaining read-heavy screens (asset-health, maintenance,
   reliability, benchmark, tender, integrations) to their respective
   backend endpoints.
1a. ~~Browser-verify Fleet Explorer and the Live BOM view end-to-end~~ —
   **done this session**, see §4a (login, real hierarchy render, live
   system creation + reload persistence, logout, protected-route
   redirect, curl-verified component delete). Still open: in-browser
   click-through of component create/delete (done via curl instead) and
   the 403 path for a non-ADMIN/MANAGER role.
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
0015dd7 docs: record frontend-backend integration session (auth + fleet slice)
d5808f2 feat(api): add locomotive detail, systems, assemblies, components endpoints
66b424c feat(fleet-explorer): connect radial hierarchy to real locomotive data
2da86dd feat(bom): add Live Locomotive BOM view backed by real systems/assemblies
6e851fa feat(bom): add component create/delete to Live Locomotive BOM
9087f77 test(api): cover locomotives, systems, assemblies, and components modules
```

All committed individually to `design-system-retrofit`, no squashing, no
force-push, no backend-repo changes.
