# ADR-008 — Console scope: separate repo; `@contentgrid/ui` published when console adopts it

**Date:** 2026-04-29
**Status:** Accepted
**Phase:** 0 — Alignment & decisions

---

## Context

ContentGrid has a console (user/IAM management, deployment management, data-model management). It is admin/operator-facing, not end-user-facing. Distinct audience, distinct release cadence, likely distinct sub-team. Visual consistency with the navigator is required: same buttons, dialogs, tables, design tokens.

The question is not *whether* to share UI code (we will), but *where* console lives:

1. Inside the navigator monorepo as `apps/console`, alongside generic/experimental.
2. As a separate project consuming `@contentgrid/ui` via npm.
3. Hybrid: monorepo grows a `packages/ui` publish lane; console stays separate.

The roadmap already treats Console-side ACC-2694 tickets as out of scope, so the cultural boundary exists. The question is whether to mirror it in the build.

## Decision

**Console stays a separate repo. It consumes `@contentgrid/ui` via npm.**

- Console is **not** included in the navigator monorepo.
- Console is **not** migrated to the new design system as part of the navigator cutover. It keeps its current build until naturally revisited.
- `packages/ui` becomes `@contentgrid/ui` — published, semver-versioned — when console (or another out-of-tree consumer) is ready to adopt it.
- Console does **not** consume `@contentgrid/navigator-data`. Resource shapes differ.

## Why separate

- **Different audience and cadence.** Admin/operator workflows ship when deployment infrastructure changes, not when content-model UX is iterated. Forcing them into one CI pipeline couples cadences that don't naturally align.
- **Different contributors.** If the same person isn't shipping navigator and console features in the same PR, the monorepo "atomic refactor" benefit doesn't fire — it just adds shared CI overhead.
- **Different data layer.** Console talks to admin APIs (users, deployments, schemas), not HAL entity APIs. The TanStack Query hooks in `@contentgrid/navigator-data` are wrong-shaped for console; console would import nothing from it.
- **Cutover discipline.** We already deferred OSS release and custom-track scaffolding to keep the migration on one front (ADR-010). Pulling console in concurrently re-creates the multi-front problem.
- **OSS release scope clarity.** "contentgrid-navigator" should be the navigator. If console were in the same repo, the OSS release (when it happens) would have an awkward boundary question.

## Why a published `@contentgrid/ui` is correct anyway

Visual consistency between two apps living in different repos *requires* a versioned design system. There's no escape from this — it's true whether console and navigator share a repo or not, because once a customer-track app moves out of the monorepo (ADR-006, ADR-009), we already need a publishable `@contentgrid/ui`.

Console is the natural **first external consumer** of the design system. That makes it the publish trigger — same pattern as ADR-007 for `navigator-data`.

## What console consumes

| Package | Provider | Notes |
|---|---|---|
| `@contentgrid/ui` | this monorepo (published) | Primitives + patterns + Tailwind preset + tokens |
| `@contentgrid/typed-fetch`, `fetch-hooks`, `fetch-hook-authentication`, `problem-details` | Xenit (peerDeps) | Same as navigator's layer 1 |
| `@contentgrid/uri-template` | Xenit (peerDeps) | If console builds typed admin URLs |

What console does **not** consume:

- `@contentgrid/navigator-data` — wrong resource shapes.
- `@contentgrid/hal`, `@contentgrid/hal-forms` — admin APIs are not HAL-shaped (or if they are, console uses them directly, not via navigator's hooks).

That's a clean three-package contract.

## Publish trigger and ceremony

**Trigger:** console (or another out-of-tree consumer) is ready to adopt the new design system.

**When triggered:**
- Add changesets to the navigator monorepo for `packages/ui`.
- Configure publish workflow: `npm publish` (or ghcr-npm) on tag `ui-vX.Y.Z`.
- Tree-shaking validation; bundle-size baseline.
- CHANGELOG via changesets.
- Compat note in README about React/Tailwind peer-version expectations.
- Estimated ~1d when needed; tracked separately from Phase 3.

**Until then:** `packages/ui` is workspace-only, exactly as designed in Phase 1.

## Sequencing

- **During navigator cutover (Phases 0–7, 10):** console is untouched. Don't touch.
- **After Phase 10:** evaluate console's adoption appetite. If the team owning console wants to migrate, the publish work for `@contentgrid/ui` becomes a small, scoped project — a few days to publish, then a navigation-of-its-own to replace console's current UI library.
- **OSS release (deferred Phase 9):** independent of console adoption, but if both happen near each other, the publish work is shared.

## Consequences

**Positive:**
- Navigator cutover stays focused. Console team has zero new dependency on navigator timelines.
- `@contentgrid/ui` becomes a real, externally-versioned design system — the right shape for any future second consumer (custom-track customer apps, embedded uses, OSS).
- Clean three-package contract for console: layer-1 Xenit + `@contentgrid/ui` + admin APIs.
- OSS release scope stays unambiguous: just navigator.

**Negative / accepted:**
- Two repos to maintain. Two CI setups. Two test infrastructures.
- Design-system bumps require coordinated PRs across repos. Mitigated by semver discipline and avoiding gratuitous breaking changes in `@contentgrid/ui`.
- Console will trail the navigator on UI improvements until it adopts the new design system. Acceptable — visual drift between admin and end-user UIs is tolerable short-term.

## Reconsider when

- Console contributors and navigator contributors converge to the same 1–2 people. Then monorepo overhead is worth paying for atomic refactors.
- A console-side pattern (e.g. a deployment-status dashboard) is reused *inside* the navigator. Then the shared surface is bigger than `@contentgrid/ui` alone, and monorepo gains real leverage.
- Console is about to be rewritten from scratch. Folding it in then is a one-time cost on a clean slate; cheaper than later.

---

**Hub:** [[README|ADR Index]]
