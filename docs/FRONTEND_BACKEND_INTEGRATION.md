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
Tests:       65/65 PASS (vitest run) — 51 from the prior session + 14 new
             this session (scenarios, tco, simulation API modules)
Build:       PASS (next build, 19 routes + sitemap)
```

## 5a. Second session — TCO, Scenarios, Monte Carlo

Added `src/lib/api/{scenarios,tco,simulation}.ts`, typed directly from the
backend's Zod schemas and Prisma models (`src/modules/{scenarios,tco,
simulation}` in `TCO_Backend`, read directly — not assumed). Confirmed
`discountRate`, `laborRate`, `fuelCostPerLiter`, and `inflationEnabled` are
stored on `Scenario` but **not consumed** by either engine
(`TCO_ENGINE_SPECIFICATION.md`'s own scenario-application table) — the
frontend does not claim changing them affects results.

- **Scenarios** (`/scenarios`): added a "Backend Scenario Library" panel
  (list/create/delete) with the exact 10-field schema, role-gated
  (create: ADMIN/MANAGER, delete: ADMIN). Edit (`PATCH`) is not built —
  same gap pattern as BOM components. The existing local comparator is
  now labeled "(reference data, not persisted)".
- **TCO** (`/simulation`): added a "Backend TCO Calculation" panel
  (`POST /tco/runs`) that picks a real locomotive + optional persisted
  scenario + horizon and renders the real `outputs` (totalCost,
  customerTCO, organizationTCO, avgAnnualCost). The local slider engine
  is untouched and now labeled "local preview, not persisted" — the two
  are intentionally distinct engines per the backend's own spec, not
  silently diverging copies.
- **Monte Carlo** (`/monte-carlo`): replaced the fake progress-bar
  animation with a real `POST /simulation-runs` call, rendering the
  persisted `percentiles` (p10/p50/p90/p95), `summary.variance`, and
  `histogram` bins. The "Risk Contribution to TCO Variance" and
  "Stochastic Input Parameters" panels stay static, now labeled
  "illustrative — not computed by the backend" (no Sobol index or input
  distribution fields exist on `SimulationRun`).

### Browser-verified live (second session)

Started both servers locally, registered a second fresh test account
(the first session's had expired/reset), seeded a locomotive + system +
assembly + component via curl, logged in, and in-browser:

1. Scenarios: opened the "New scenario" form, created a real scenario via
   `POST /scenarios`, confirmed it rendered immediately **and survived a
   full page reload** (persisted, not local state).
2. TCO: clicked "Run TCO calculation" against the real locomotive — got
   real `outputs` back ($28,800 total cost / $12,000 organization TCO /
   $1,440 avg annual, for the single seeded Turbocharger component),
   visibly distinct from the unrelated local-preview KPI row above it.
3. Monte Carlo: clicked "Run 1,000 Draws" — **first attempt returned a
   real 400** (`horizonYears is required when no scenario supplies
   planningHorizonYears`), a genuine bug (the submit call omitted
   `horizonYears`). Fixed by defaulting to 20 years (commit `2f6b941`),
   re-tested, and got a real persisted run back with real percentiles
   (p10 $27k / p50 $29k / p90 $32k / p95 $33k — correctly scaled to the
   single-component test locomotive, not the old $3.8M fleet-wide mock
   figures).

Not exercised in-browser: a non-ADMIN/MANAGER 403 on scenario create, and
org-isolation across two different organizations (the two test accounts
used in this project were both single-org smoke tests, not a cross-org
isolation test).

## 5b. Third session — Maintenance, and a critical backend-scope finding

**The backend only has 10 modules, total**: `assets`, `auth`, `costs`,
`fleets`, `health`, `organizations`, `scenarios`, `simulation`, `tco`,
`users` (`ls TCO_Backend/src/modules`). Of the 9 screens this session's
request prioritized (maintenance, reliability, asset-health, benchmarking,
forecasting, tender, integrations, sustainability, configuration), **only
maintenance has a backing module** (`costs`: maintenance-schedules and
cost-records, scoped per locomotive). The other 8 have zero backend routes,
zero Prisma models, nothing to connect to — not an oversight, an actual gap.
Wiring any of them would mean fabricating endpoints, which the integration
mandate explicitly disallows. They remain local/synthetic and are
documented as **blocked by backend** in §6, not "not done yet."

Since this was previously undisclosed in the UI itself, all 9 pages
(asset-health, benchmark, configure, forecasting, integrations, library,
reliability, sustainability, tender) now carry a "Preview data"
`StatusBadge` next to the page title (`mark` prop on `PageHeader`), so the
synthetic-data status is visible to users, not just to this doc.

Also found: `organizations` (`GET/PATCH /organizations/me`) and `users`
(`GET/POST/PATCH role/DELETE /users`) modules exist with no corresponding
frontend screen at all (no team/admin-settings route exists in this app).
This is a product decision, not a coding task — flagging it rather than
inventing a settings page nobody asked for.

Added `src/lib/api/costs.ts` (list/create/update/delete maintenance
schedules; list/create cost records — the backend has no update/delete for
cost records, it's an append-only ledger by design) and a "Live Maintenance
& Cost Ledger" panel on `/maintenance`, additive to the existing Part-level
visit planner (now labeled reference data), following the same pattern as
BOM and Scenarios.

### Browser-verified live (third session)

Started both servers, registered a fresh ADMIN test account (the prior
session's had again expired/reset — the backend's dev database does not
persist reliably between sessions; do not assume prior sessions' seeded
data still exists) plus a VIEWER account in the same org via
`POST /users`, seeded a locomotive via curl, and in-browser:

1. Logged in as ADMIN, opened `/maintenance`, confirmed the Live panel's
   empty state ("No persisted schedules yet") with no console errors.
2. Created a real schedule via the form — appeared immediately **and
   survived a full page reload**.
3. Deleted it via the "Remove" button — confirmed removed, not just
   hidden client-side.
4. Logged in as VIEWER (role that cannot write per the backend's
   `requireRole('ADMIN','MANAGER')`), confirmed via curl that
   `POST .../maintenance-schedules` genuinely 403s for this role, then
   confirmed in-browser that the "New schedule" button is **not rendered**
   for VIEWER on `/maintenance`, and the "New scenario" button is likewise
   hidden on `/scenarios` — closing the "403 path not exercised" gap from
   the second session for these two screens (TCO and component-create role
   gating were not re-checked this pass; same gating logic, not
   independently re-verified).

### Final verification, this session

```
Lint:        PASS (eslint .)
Typecheck:   PASS (tsc --noEmit)
Tests:       72/72 PASS (vitest run) — 65 from prior sessions + 7 new
             this session (src/lib/api/costs.test.ts)
Build:       PASS (next build, 19 routes + sitemap)
```

Git remote note: `origin` was pointed at `arkabera2004/locomotive.git`,
which `gh repo view` confirmed is the same repository renamed to
`arkabera2004/TCO.git` under the same owner (not a different destination —
verified via `gh repo view arkabera2004/locomotive` and
`arkabera2004/TCO` both resolving to `nameWithOwner: "arkabera2004/TCO"`
before changing anything). Updated `origin`'s URL to the canonical one;
`sahay` (`WayamAI/TCO_SAHAY_Frontend`) and `wayam` (`WayamAI/TCO`) remotes
were left untouched — reconciling which of the three remotes is the
intended long-term canonical repo is a product/ops decision, not made here.

## 5c. Fourth increment — scenario editing, browser-verified live

Added scenario editing (`PATCH /api/v1/scenarios/:id`) to the "Backend
Scenario Library": an "Edit" button per row (ADMIN/MANAGER only) pre-fills
the existing create form and calls `updateScenario` instead of
`createScenario`. Closed the "edit not built" gap from §7's prior list.

Browser-verified live: registered a fifth fresh test account, seeded a
scenario via curl, logged in, clicked "Edit," confirmed the form
pre-filled with the real values, changed the name, saved, confirmed the
updated name appeared immediately, then **reloaded the page and confirmed
the new name persisted and the old name was gone** — a genuine `PATCH`
round-trip, not local state. Final regression after this change: lint PASS,
typecheck PASS, 72/72 tests PASS, `next build` PASS.

## 5d. Fifth increment — maintenance schedule editing, browser-verified live

Same pattern again, now for maintenance schedules: an "Edit" button per row
(ADMIN/MANAGER only) pre-fills the existing create form and calls
`updateMaintenanceSchedule` instead of `createMaintenanceSchedule`. Closes
that item from §7's prior list.

Browser-verified live: registered a sixth fresh test account, seeded a
locomotive + schedule via curl, logged in, clicked "Edit," confirmed the
form pre-filled with the real values, changed the name, saved, then
**reloaded the page and confirmed the new name persisted and the old name
was gone**. One environment note from this pass: a stale session from a
previous increment's test account was still in this browser profile's
`localStorage` and silently took priority over the newly-registered
account on first login attempt (the login form submit appeared to succeed
but the app was actually still authenticated as the old user) — caught by
checking `locomotives.length` was unexpectedly 0, not by a UI error.
`localStorage.clear()` before logging in as a new test account avoids
this; flagging it as a verification-process gotcha for future sessions,
not a product bug (real users don't switch test accounts in the same
browser profile without logging out first, and logout does clear the
session correctly, as verified in earlier sessions). Final regression:
lint PASS, typecheck PASS, 72/72 tests PASS, `next build` PASS.

## 5e. Sixth increment — component rename, browser-verified live

Added component rename (`PATCH /api/v1/components/:id`) to Live BOM: an
inline "Edit" control per component row (ADMIN/MANAGER only), scoped to
the `name` field only — matching the existing create form's minimal field
set (engineering fields like MTBF/Weibull/warranty still default and are
not yet editable; a full field-by-field editor is deferred until a real
workflow needs it, not fabricated here).

Browser-verified live: registered a seventh fresh test account (clearing
`localStorage` first this time, per the §5d gotcha), seeded a locomotive →
system → assembly → component via curl, logged in, switched to "Live
Locomotive BOM," clicked "Edit" on the component, confirmed the inline
input pre-filled with the real name, changed it, saved, then **reloaded
the page and confirmed the new name persisted and the old name was gone**.
Final regression: lint PASS, typecheck PASS, 72/72 tests PASS,
`next build` PASS.

## 5f. Seventh increment — TCO/simulation run history, browser-verified live

Added persisted run history to both `/simulation`'s "Backend TCO
Calculation" panel (`GET /locomotives/:id/tco-runs`) and `/monte-carlo`
(`GET /locomotives/:id/simulation-runs`). Each lists a locomotive's past
runs below the result display; clicking one loads its real outputs into
the same KPI/chart display a fresh submission uses — a past result and a
new one render identically except by which history row is highlighted.
History reloads when the locomotive changes or a new run is submitted.

Browser-verified live: registered an eighth fresh test account, seeded a
locomotive + component, then seeded **2 TCO runs (10yr/20yr horizons) and
1 simulation run (500 iterations)** directly via curl so the history had
real, distinguishable rows to click. On `/simulation`: confirmed both rows
rendered with correct timestamps and totals ($28,800 for 20yr, $14,400 for
10yr), clicked the 10yr row, confirmed the KPI tiles switched to show
exactly $14,400 (not the 20yr figure). On `/monte-carlo`: confirmed the
history panel rendered "1 persisted run," clicked it, confirmed the page
header updated to show the real seed (`516ad75c...`) and 500 iterations —
matching the curl-seeded run exactly, not a different one.

One environment note: the history panel rendered correctly in the DOM
(`getBoundingClientRect` confirmed real layout and position) but was
positioned below the automation tool's effective scroll range in this
session, same as a scroll quirk seen in an earlier increment — not a
product bug, confirmed by reading `textContent` and clicking the element
directly via its DOM reference rather than relying on a screenshot. Final
regression: lint PASS, typecheck PASS, 72/72 tests PASS, `next build` PASS.

## 5g. Verification-only pass — cross-org isolation and remaining 403 checks

No code changes this pass — closing two verification gaps from §7 with
genuinely separate test organizations (not just two users in one org).

**Cross-organization isolation**: registered two brand-new accounts with
different `organizationName`s (confirmed different `organizationId`s in
the JWT), seeded a locomotive under Org A, then as Org B: `GET
/locomotives` returned `count: 0` (not Org A's locomotive), `GET
/locomotives/:id` for Org A's real locomotive ID returned 404
(`RESOURCE_NOT_FOUND`, no data leak), and `DELETE` on it also 404'd.
Repeated the GET check using the actual frontend session token (logged in
as Org B in-browser, read its real `accessToken` from `localStorage`, hit
the backend directly) — same 404, confirming the isolation holds for the
exact token the frontend itself uses, not just a separately-minted curl
token.

**403/permission-model checks**: added a VIEWER-role user to Org A via
`POST /users`, then confirmed via curl that `POST /tco/runs` returns
**201** for VIEWER (no role gate — matches the backend's documented
"any authenticated user" policy for TCO/simulation) while `POST
.../systems` and `POST .../components` both return **403** (ADMIN/MANAGER
only). Then browser-verified the frontend matches this exactly: logged in
as the VIEWER, confirmed BOM's "Add System"/"Add component" controls are
absent, and confirmed the "Run TCO calculation" button is present and
**does submit successfully** — the frontend doesn't over-restrict a role
the backend actually permits, nor under-restrict one it doesn't.

## 5h. Production deployment audit — critical finding, not fixed

Investigated whether `tco.wayam.ai` (flagged as a possible mismatch in a
prior session) still diverges from this Next.js repo, and whether this
repo's own linked Vercel project is actually serving it. Read-only
investigation only — no deployment was triggered, no DNS or Vercel config
was changed.

**Finding**: `tco.wayam.ai` and this repo's own linked Vercel project
(`.vercel/project.json` → project `tco`, production URL
`locomotivewabtec-main.vercel.app`) serve **byte-identical HTML**, and
neither is this Next.js app. Both show a TanStack Router/Vite build
(hashed `/assets/*.js` bundles, a `$tsr` TanStack stream barrier script,
no `_next/static` paths, no `__NEXT_DATA__`) — the same legacy frontend a
prior session's audit flagged, still live.

`vercel ls tco` shows the project's most recent production deployment is
**64 days old**, with ~17–19s build durations (consistent with a small
Vite build, not a Next.js build — this repo's own local `next build` just
took several seconds of TypeScript + static generation alone). This repo
has had dozens of commits since then (every increment in this document).
**This Next.js codebase has likely never been deployed to this Vercel
project at all.**

`vercel env ls` for the `tco` project returns **zero environment
variables** — meaning even a fresh deploy of this app would fall back to
`NEXT_PUBLIC_API_BASE_URL`'s default (`http://localhost:8000`) in
production, which cannot reach a real backend. No production backend URL
for `TCO_Backend` was found or assumed — it has only been run locally in
every session so far.

**Not fixed, by design**: triggering a production deploy, changing Vercel
project settings, or pointing a live custom domain (`tco.wayam.ai`) at a
different build are infrastructure actions with real, user-facing
consequences. They need explicit authorization and a real backend
deployment target to point `NEXT_PUBLIC_API_BASE_URL` at — neither exists
yet in anything this session observed. Documented here as the concrete
blocker instead.

## 6. Feature → endpoint mapping (current state only)

| Feature | Backend endpoint | Status |
|---|---|---|
| Login | `POST /api/v1/auth/login` | **Connected, verified live** |
| Logout | `POST /api/v1/auth/logout` | **Connected, verified live** |
| Token refresh | `POST /api/v1/auth/refresh` | Connected, covered by unit tests (401→refresh→retry); not separately exercised live in-browser this session |
| Dashboard "Fleet Status & Health" | `GET /api/v1/locomotives` | **Connected, verified live** |
| Fleet Explorer (radial hierarchy) | `GET /api/v1/locomotives`, `GET /api/v1/locomotives/:id` | **Connected, verified live** (see §4a). RUL is a client-side estimate (`lifeYears - currentHours/8760`), not a backend-persisted figure. |
| BOM — "Live Locomotive BOM" view | `GET /api/v1/locomotives/:id`, `POST .../systems`, `POST .../systems/:id/assemblies`, `POST/PATCH/DELETE /api/v1/components`, `POST /api/v1/locomotives/:id/components` | **Connected, verified live** (see §4a, §5e) for System/Assembly/Component read + create, Component delete, and Component rename. System/Assembly have **no edit or delete** — the backend doesn't expose those operations (only nested create + read via the locomotive tree), so none is built. Component create/edit only expose `name` — engineering fields (MTBF, Weibull β/η, warranty, labor %, downtime cost) default on create and are not yet editable. |
| BOM — 5-Level Hierarchy Tree / Inventory & Criticality / Depreciation & Capital views | none — these operate on a `Part` sub-level (below Component) that **does not exist in the backend's Prisma schema** | **Static reference data, now labeled as such in the view switcher.** Not rewired — see §7. |
| Scenarios — "Backend Scenario Library" | `GET/POST/PATCH/DELETE /api/v1/scenarios` | **Connected, verified live**, full CRUD including edit (see §5a, §5c). |
| Scenarios — local comparator | none (local data + fabricated TCO formula) | **Static reference data, now labeled as such.** |
| TCO — "Backend TCO Calculation" panel | `POST /api/v1/tco/runs`, `GET /locomotives/:id/tco-runs` | **Connected, verified live**, including persisted run history (§5a, §5f). |
| TCO — local slider playground | none (local `runTCOSimulation` engine) | **Local preview, now labeled as such.** Intentionally kept distinct from the backend engine per `TCO_ENGINE_SPECIFICATION.md`. |
| Monte Carlo | `POST /api/v1/simulation-runs`, `GET /locomotives/:id/simulation-runs` | **Connected, verified live**, including persisted run history (§5a, §5f) and a real bug found and fixed during §5a's verification. Variance-driver and input-distribution panels stay static/illustrative — no backend equivalent. |
| Maintenance — "Live Maintenance & Cost Ledger" panel | `GET/POST/PATCH/DELETE .../maintenance-schedules`, `GET/POST .../cost-records` | **Connected, verified live**, full CRUD including edit (see §5b, §5d), including role-gating verified with a real VIEWER account. Cost records are append-only by backend design — no edit/delete exists or is built. |
| Maintenance — Part-level visit planner | none (local engine, same pattern as BOM's Part level) | **Static reference data, now labeled as such.** |
| Reliability, Asset Health, Benchmark, Forecasting, Tender, Integrations, Sustainability, Configuration (Product Taxonomy / Maintenance Rules / Standards Compliance tabs) | **none — no backend module exists for any of these** (confirmed by listing `TCO_Backend/src/modules`: only `assets, auth, costs, fleets, health, organizations, scenarios, simulation, tco, users`) | **Blocked by backend — not a frontend gap.** Still synthetic/local; wiring them would require fabricating endpoints, which is out of scope by the integration mandate itself. |
| Organization settings (`GET/PATCH /organizations/me`) and team/user management (`GET/POST/PATCH-role/DELETE /users`) | `GET/PATCH /organizations/me`, `GET/POST /users`, `PATCH /users/:id/role`, `DELETE /users/:id` | **Connected, verified live.** New `/settings` screen (ADMIN-gated, matching the backend's `requireRole('ADMIN')`): org rename, member list, invite, role change, deactivate. Browser-verified against a live registered ADMIN account — rename, invite, role change, and deactivate all persisted through a page reload; a VIEWER-role session correctly sees an "Admin access required" empty state instead of the forms. |
| Dashboard KPI tiles, cost timeline, part-level table on `/`; `library`; `glossary` | none | **Still synthetic/local** (glossary is static reference content by design, not a gap) — not audited this session. |

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

## 7. Remaining work

The original request specified 10 phases covering every route, full UI
design-system stabilization, deployment reconciliation, and three
documentation files. Seven increments have now connected: auth +
dashboard, Fleet Explorer + Live BOM (full CRUD except system/assembly
edit/delete, which the backend doesn't support), Scenarios (full
CRUD)/TCO/Monte Carlo with persisted run history, and Maintenance (full
CRUD) (see §6). Cross-organization isolation and the remaining 403
role-gating checks were verified in §5g with no code changes needed. Not
done, in priority order — genuinely actionable items first, then
backend-blocked items that are not frontend work at all:

1. ~~Component full field editing in Live BOM~~ — **done.** The edit form
   now covers every field `updateComponent` accepts (purchase/replacement
   cost, life years, MTBF, Weibull β/η, MTTR, warranty, labor %, failure
   impact, category, downtime cost/day), pre-filled from the component's
   real current values instead of defaulting on save.
2. Typography/spacing/theme/logo/responsive UI pass (Phase 1 of the
   original request) — not started in these seven increments; a prior,
   separate stabilization pass exists in `docs/FRONTEND_STABILIZATION.md`
   but predates the fleet-explorer/bom/scenarios/tco/maintenance/settings
   changes and should be re-run against them.
3. ~~A decision on whether to build a team/org-settings screen~~ — **done.**
   Built `/settings` (ADMIN-only) wired to the backend's `organizations`
   and `users` modules; browser-verified live.
4. **Deploy this Next.js app to production** — confirmed in §5h this has
   likely never happened. `tco.wayam.ai` and this repo's own linked
   Vercel project (`tco`) both still serve a 64-day-old legacy
   TanStack/Vite build. Blocked on: (a) explicit authorization to trigger
   a production deploy / touch the live custom domain, and (b) a real
   deployed `TCO_Backend` URL to set `NEXT_PUBLIC_API_BASE_URL` to — the
   backend has only been run locally in every session so far.

**Backend-blocked, not frontend work** (§5b, §6): Reliability, Asset
Health, Benchmark, Forecasting, Tender, Integrations, Sustainability, and
Configuration have no backend module at all. These cannot be connected
without new backend endpoints — raise with the backend workstream if they
need to become real.

## 8. Commit hashes (chronological, both sessions)

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
d661b5e docs(frontend): update integration matrix for fleet-explorer and bom
fe41f88 docs(frontend): record live browser verification of fleet-explorer/bom
93e9e23 feat(api): add scenarios, tco, and simulation endpoint modules
ba0f928 feat(scenarios): add Backend Scenario Library (real list/create/delete)
cc27824 feat(monte-carlo): submit real simulation runs to POST /simulation-runs
58561d1 feat(tco): add Backend TCO Calculation panel to the simulation page
2f6b941 fix(monte-carlo): pass horizonYears on simulation run submission
9dcf252 docs(frontend): record TCO/scenarios/monte-carlo session and verification
1c9777b feat(api): add costs endpoint module (maintenance schedules, cost records)
f507d21 feat(maintenance): add Live Maintenance & Cost Ledger panel
e0cf8cf docs(frontend): record maintenance session, backend-scope audit, remote fix
307eac4 feat(scenarios): add scenario editing (PATCH /scenarios/:id)
a9f6493 docs(frontend): record scenario-edit verification, close remaining-work item
9c2a1aa feat(maintenance): add schedule editing (PATCH /maintenance-schedules/:id)
ff3a811 docs(frontend): record maintenance-schedule-edit verification
00cd7f4 feat(bom): add component rename (PATCH /api/v1/components/:id)
42ca386 docs(frontend): record component-rename verification
92d66e7 feat(tco,monte-carlo): add persisted run history UI
c6040b6 docs(frontend): record TCO/simulation run history verification
```

(This document's own update commit for the cross-org/403 verification
pass follows this one in the log, committed after this edit — no source
changes in that pass, verification only.)

All committed individually to `design-system-retrofit` and pushed to
`origin` after each commit, no squashing, no force-push, no backend-repo
changes.
