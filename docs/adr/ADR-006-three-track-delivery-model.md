# ADR-006 — Three-track delivery model: generic, experimental, custom

**Date:** 2026-04-29
**Status:** Accepted (custom track scaffolding deferred — see ADR-010)
**Phase:** 0 — Alignment & decisions

---

## Context

The modernised navigator must serve three distinct audiences from one codebase:

1. **Generic** — robust default UI for any ContentGrid content model. Drives the eventual OSS release.
2. **Experimental** — customer demos, in-flight ideas, not-yet-promoted features. Must never ship as production.
3. **Custom** — bespoke per-customer UIs. Strategic direction (one generic UI cannot fit all customers).

Naive options — env-toggled feature flags, long-lived branches, separate forks — all create maintenance pain we want to avoid.

## Decision

**Three apps in one monorepo, gated by a per-feature stability flag.**

| Track | App path | Deployment | Stability tier consumed |
|---|---|---|---|
| Generic | `apps/navigator` | public production | `stable` only |
| Experimental | `apps/navigator-experimental` | internal-only (auth-gated preview env, never a public URL) | `stable` + `candidate` + `experimental` |
| Custom | `apps/<customer>/` | per-customer (private repo per ADR-013) | declared per-app via `customer.config.ts` |

**Features live in `packages/features/<name>/` and carry a `x-stability` flag in their `package.json`:**

```
experimental → candidate → stable
```

- ESLint rule blocks the generic build from importing non-`stable` features (see HZN-1.9).
- CI bundle audit fails the build if experimental feature code appears in the generic bundle (see HZN-1.9).
- The experimental track is the seeding ground for the initial set of stability-flagged features (see HZN-1.10).
- Promotion = a PR that flips the flag + adds the feature to generic's allowlist. No code move, no fork drift.
- **Promotion-dependency check:** before opening a promotion PR, contributors run `pnpm --filter <feature> exec contentgrid-stability check` (or read the package's transitive `x-stability` graph) to surface any `candidate`-tier dependencies that must promote first. A feature ready for `stable` is blocked until its dependency chain is `stable` end-to-end — this is graph-aware, not point-and-click, and the check exists so the chain is visible before review, not during.

## Why this shape

- **Demos run on an internal, auth-gated preview environment — never a public URL.** Prospects see in-flight UX in a controlled setting; nothing half-built is exposed publicly. The OSS release ships the experimental *source* (so contributors can build it themselves), but no `experimental.contentgrid.*` artifact is hosted.
- **Promotion is a code review, not a port.** Features written in experimental are usable in generic the next day if they pass review. No rewrite tax.
- **One CI pipeline, two deploy lanes.** No duplicate maintenance of pattern code across forks.
- **Custom apps consume `packages/*` only.** They benefit from generic improvements automatically. Customer code lives in `apps/<customer>/` and a thin `customer.config.ts`.

## What this is *not*

- **Not feature flags in production.** No env-toggled experimental code runs in the generic bundle. The boundary is a build-time exclusion enforced by lint + bundle audit.
- **Not a long-lived branch model.** Everything is on `main`. Gating is at the package layer, not the VCS layer.
- **Not a fork.** Experimental and generic share every line of code in `packages/`. The only diff is which features are bundled.

## Custom track is real strategy, scaffolding is deferred

The decision is unchanged: every customer needs a bespoke UI; one generic does not fit all. But the **scaffolding investment** (template, schema, generators) is deferred until the first new customer customisation actually ships. See ADR-010 for sequencing rationale and ADR-013 for the private-repo delivery model.

In the meantime: `packages/ui` and `packages/navigator-data` are designed scaffolding-friendly, so when the trigger comes, building the template is not a redesign — it's assembly.

The existing customer UI (already in flight) is **not revisited** as part of this migration. It stays on its current build until naturally superseded.

## Consequences

**Positive:**
- Customers get tailored UIs without the team forking three codebases.
- Demo work doesn't pollute production. Sales and engineering work in parallel without colliding.
- Promotion path is mechanical and reviewable.
- OSS release ships only `stable` features — no half-built work leaks.

**Negative / accepted:**
- Stability flag is one more thing every contributor must remember when adding a feature. Mitigated by Phase 1.9 lint enforcement and per-package CLAUDE.md.
- Generic bundle audit must be wired correctly or the boundary leaks silently. CI gate is the mitigation.
- Custom track scaffolding investment (Phase 8) is a real future cost. Deferred but not free.
- An experimental feature that depends on a `candidate` package can't be promoted to `stable` until its dependencies are also promoted — promotion is graph-aware, not point-and-click.

## Reconsider when

- Generic features and experimental features stop sharing meaningful code (e.g. teams diverge on stack). Then a fork might be cheaper than gating.
- Customer count grows past the point where a template scales — at which point a code generator with stronger guarantees may be needed.
- The OSS community wants to ship features that don't fit the stability tiering. Then we add a tier (e.g. `community`) rather than abandoning the model.

---

**Hub:** [[README|ADR Index]]
