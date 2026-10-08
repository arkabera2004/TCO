# Deployment reconciliation

## Current production source (tco.wayam.ai)

`tco.wayam.ai` is a Vercel deployment (confirmed via `curl -I`, `server: Vercel`, DNS
CNAME to `vercel-dns`) of **`sahay/main`** — a Vite + React (TanStack Router) build,
`package.json` name `"sahay"`. That branch is mirrored identically on two GitHub
remotes: `WayamAI/TCO_SAHAY_Frontend` and `WayamAI/TCO`, both at commit `36d4702`
("Merge pull request #2 from WayamAI/design-system-retrofit").

## This repository

This repo (`origin` = `arkabera2004/locomotive`, branch `design-system-retrofit`) is a
**Next.js 16 / App Router rewrite of the same product**, not a separate app. Its history
shares a common ancestor with the Vite branches at commit `9e893ce`
("fix(fleet-explorer): refine replacement cost KPI label to prevent truncation") — the
exact tip of `sahay/main` before the Vite→Next.js migration branched off. Commit
`0db160a` ("chore(gitignore): remove stale Vite/TanStack build-output entries") in this
repo's history is direct evidence of that migration in progress.

This repo is **ahead** of what's deployed: it carries the completed theme-toggle fix
(`2ed1e1a`, `def2feb`, `4479eb9`), route-metadata-title fixes, and a Vitest suite that
don't exist on `sahay/main`.

## Conclusion

- **Canonical going forward: this Next.js repository.** `sahay/main` (Vite) is the
  live-but-stale predecessor it is migrating away from — not a separate product and not
  safe to delete (it's still what's actually serving `tco.wayam.ai` traffic today).
- Do **not** merge or push this branch over `sahay/main` until the migration is verified
  complete (full route parity, no regressions) — that verification is out of scope for
  this stabilization phase.
- The KPI-value instability observed during the audit was reproduced only against the
  live `tco.wayam.ai` (Vite) deployment; this repo's own dev server produces stable,
  deterministic KPIs across reload and navigation (see `tcoEngine.test.ts`'s
  determinism tests). No non-determinism was found in this repo's source.

## Open item requiring a decision outside this session

Actually repointing the `tco.wayam.ai` Vercel project to build this repository (or
merging this branch into `sahay/main`) requires access to the Vercel org that owns the
live deployment (`team_vLMt1MvMSovATfeX36ftP6jS`) and/or push rights to
`WayamAI/TCO_SAHAY_Frontend` — neither of which this session's credentials have (the
authenticated Vercel CLI user only has access to a different team, `arka-s-team`). That
cutover is a Phase 2+ decision for whoever owns those credentials, not something to do
unattended.
