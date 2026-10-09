# Frontend Stabilization Audit — 2026-10-09

## Scope and method

This audit re-verified the current state of the `design-system-retrofit` branch
(HEAD `f4ee560` at audit start) against the UI-quality checklist: oversized
numbers, typography, light/dark theming, logos, layout/overflow, charts, and
browser console health. It builds on prior stabilization commits already on
this branch (theme toggle, dark-mode persistence, invisible gauge-text fix,
TCO determinism tests).

Given session scope, this pass prioritized the shared design-system primitives
(`KPICard`, `KpiTile`, `tokens.css`/`globals.css`, formatters) and a targeted
browser walkthrough, rather than a line-by-line review of all 19 routes.

## Baseline validation (before and after)

```
Lint:             PASS (eslint .)
TypeScript:       PASS (tsc --noEmit)
Tests:             27/27 PASS (vitest)
Production build: PASS (21 routes, Next.js 16 / Turbopack)
```

No regressions were introduced; no code changes were required by this pass
(see Findings).

## Findings

1. **False positive — Michroma "%" glyph.** The dashboard's "Fleet Availability"
   KPI (`93.6%`) renders with Michroma's stylistic percent-sign glyph (small
   circle–slash–circle), which at a glance can be misread as "93.6%o". Zoomed
   inspection confirmed the underlying value is the plain string `"93.6%"` —
   this is an intentional font design choice, not a formatting bug, and no
   literal "o" character exists in the DOM. No fix applied.
2. **KPI primitives already sized per hierarchy.** `KPICard` (compact,
   `--text-display-metric: 40px`) and `KpiTile` (`text-display-xl` →
   `sm:text-display-2xl`) already use distinct, responsive scales with
   `tabular-nums`, `min-w-0`/`truncate` on labels and hints. No oversized or
   clipped values were observed on Command Center, BOM Explorer, or Monte
   Carlo in either theme.
3. **Dark/light theme.** Verified visually on Command Center, BOM Explorer,
   and Monte Carlo: backgrounds, card surfaces, chart colors, badges, and the
   theme-toggle icon (sun/moon) all switch correctly with no hardcoded colors
   observed breaking contrast. Protected-route redirect (`/login` → `/` when
   already authenticated) behaved correctly.
4. **Browser console** was clean (no errors/warnings) across the routes
   checked.

## Routes actually browser-tested

`/` (Command Center), `/bom`, `/monte-carlo`, `/login` (redirect check) — each
in both light and dark mode at desktop width (1470px).

## Not covered in this pass

- The remaining 15 routes (`fleet-explorer`, `simulation`, `scenarios`,
  `forecasting`, `maintenance`, `reliability`, `asset-health`, `benchmark`,
  `tender`, `integrations`, `library`, `glossary`, `configure`,
  `sustainability`, `not-found`) were source-reviewed for obvious oversized/
  hardcoded-color classes (none found beyond the KPI primitives already
  covered) but were not individually browser-walked in this session.
- Responsive breakpoints below desktop width were not verified in-browser;
  the window-resize tool available in this session did not change the
  effective viewport, so narrow-width (320–768px) rendering is unverified.
- Full accessibility audit (keyboard nav, focus order, screen-reader labels)
  was not performed.
- No deployment/production changes were made or attempted (out of scope,
  per prior reconciliation notes in this repo).

## Conclusion (2026-10-09, pass 1)

No defects were found in the areas inspected that warranted a code change;
the branch's prior stabilization commits already addressed the KPI-sizing,
theming, and font issues this audit was asked to re-check. This document
records the audit itself as the artifact of this session's work.

---

## Pass 2 — full-route, cross-viewport re-audit (2026-10-09, continued)

Continuation of the above, covering the routes and viewports left open in
"Not covered in this pass" above.

### Viewport note

The browser-automation window in this environment clamps to two effective
sizes regardless of the width/height requested: ~1470×801 (first/default tab
— used as the desktop viewport) and ~500×667 (a second tab opened after the
first — used as the mobile/narrow proxy, close to the 430px breakpoint
target). Requests for an intermediate "tablet" size (e.g. 820×1180) were
silently clamped back to 500×667. **Tablet-width (768–1024px) rendering was
therefore not independently verified** — this is a tool/environment
limitation, not a skipped step.

### Routes browser-tested this pass (desktop 1470px + mobile ~500px, light
and dark)

`/`, `/bom`, `/simulation`, `/scenarios`, `/monte-carlo`, `/forecasting`,
`/maintenance`, `/reliability`, `/asset-health`, `/benchmark`, `/tender`,
`/integrations`, `/configure`, `/glossary`, `/library`, `/sustainability`,
`/fleet-explorer`, and the 404 (not-found) page. All 19 routes from the
inventory were loaded in-browser in this pass; `/login` redirect behavior was
verified in pass 1.

A scripted sweep (`document.documentElement.scrollWidth` vs `innerWidth`) at
the 500px width confirmed **zero horizontal overflow** on every route above.

### Confirmed issue found and fixed

**Breadcrumb/page-title fallback showed "Command Center" on unknown routes.**
`src/components/layout/AppShell.tsx` built its header `<h1>` from
`CRUMB[pathname] ?? "Command Center"`. Any path not in the route map (e.g. the
404 page) rendered the header title "Command Center" instead of something
reflecting the actual (missing) page — misleading on the one page where the
user most needs a clear signal that something went wrong.

- Fix: fallback changed to `"Not Found"` (both the visible text and the
  `title` attribute).
- Verified: navigated to `/does-not-exist` before and after; screenshot
  confirms the header now reads "Not Found" instead of "Command Center",
  sidebar correctly shows no active item, body 404 content unchanged.
- Commit: `fix(shell): correct breadcrumb title on unknown routes`.

### Investigated and ruled out (not bugs)

- **Michroma "%" glyph** ("93.6%" reading as "93.6%o" at a glance) — font
  design, not a literal character; confirmed again in pass 1, re-confirmed
  via DOM text inspection.
- **KpiTile digit glyphs looking smaller than mixed alphanumeric values**
  (Asset Health: "6" and "4" visually smaller than "84.2%"/"88%" in the same
  grid row). Measured via `getComputedStyle` and `Range.getBoundingClientRect`
  on all four cards: identical `font-size` (22px), identical line-box height
  (26.4px), identical ink bounding-box height (31.5px) across all four
  values. The size difference is purely Michroma's per-glyph ink proportions,
  not a CSS/layout bug — no fix applied (an arbitrary per-string font-size
  hack would violate the "no global CSS hacks" / "preserve the brand font"
  constraints for a cosmetic non-issue).
- **Fleet Explorer Weibull gauge showing "0.0%" on initial load.** The
  default-selected component (`cmp-005`) has `currentHours` (22,000h) far
  past its Weibull characteristic life (η=5,500h, β=3.5); computing
  `R(t) = exp(-(t/η)^β)` gives a reliability effectively indistinguishable
  from 0 at double precision. This is mathematically correct output for an
  overdue/high-risk default component, not a rendering defect — confirmed by
  clicking a different node and seeing the gauge correctly recompute to
  98.0%.

### Accessibility spot-check

- Both `IconButton` usages in the shared shell (hamburger "Open navigation",
  theme toggle "Switch to light/dark theme") and the mobile drawer's close
  button already carry correct `aria-label`s.
- Logo `<img>` tags (sidebar, login) already carry `alt="Wayam AI"`.
- No additional accessibility defects were found in the components touched
  this pass; a full keyboard-navigation/focus-order/screen-reader walkthrough
  was not performed (same limitation as pass 1).

### Validation (after the fix)

```
Lint:             PASS (eslint .)
TypeScript:       PASS (tsc --noEmit)
Tests:             27/27 PASS (vitest)
Production build: PASS (21 routes, Next.js 16 / Turbopack)
Browser console:  No errors across all routes tested
```

### Remaining unresolved / unverified

- Tablet-width (768–1024px) visual verification — blocked by the
  browser-automation window clamp described above.
- Full accessibility audit (keyboard tab order, screen-reader labelling
  beyond the spot-check above, reduced-motion handling).
- Production/deployment reconciliation (`tco.wayam.ai` still on the legacy
  Vite build) — out of scope per prior notes, access-gated.
