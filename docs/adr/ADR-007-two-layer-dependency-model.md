# ADR-007 — Two-layer dependency model: existing core packages (peerDeps) + composition layer

**Date:** 2026-04-29
**Status:** Accepted (publish ceremony deferred — see ADR-010)
**Phase:** 0 — Alignment & decisions

---

## Context

Backend coupling for the navigator is partly external already. Xenit publishes seven `@contentgrid/*` packages covering HAL, HAL-Forms, typed fetch, fetch-hooks, OIDC auth, problem-details, and URI templates. We consume them as direct dependencies today.

On top of that, we maintain navigator-side composition: TanStack Query hooks, ETag/`If-Match` policy, Zod-validated config, MSW fixtures, and the HAL-Forms→shadcn bridge (ADR-004). Where should this live? Mixed into the app, in a workspace package, or published as its own thing?

## Decision

**Two layers, with a hard rule: do not re-vendor anything from layer 1.**

```
Layer 1 — existing @contentgrid/* packages (peerDependencies)
  @contentgrid/hal, hal-forms, typed-fetch, fetch-hooks,
  fetch-hook-authentication, problem-details, uri-template

Layer 2 — composition layer (workspace package today; publish-ready surface)
  @contentgrid/navigator-data
    ├─ apps/navigator               (generic)
    ├─ apps/navigator-experimental
    └─ apps/<customer>/             (custom track, when scaffolded)
```

**`@contentgrid/navigator-data` contains only what isn't in a Xenit package:**

- Composition glue: typed-fetch + auth hooks + problem-details wired into a usable client.
- TanStack Query hooks: `useEntity`, `useList`, `useCreate`, `useUpdate`, `useDelete`, `useRelation`, `useSearch`.
- ETag / `If-Match` optimistic-concurrency policy.
- HAL-Forms → `FieldDescriptor[]` bridge (ADR-004).
- Zod-validated app config + presets.
- MSW handler fixtures for tests, exported for consumer reuse.

It does **not** re-implement HAL parsing, HAL-Forms parsing, fetch composition, or auth. Those are Xenit's job and are declared as `peerDependencies`.

## Why two layers (not one big composition adapter)

- If we re-vendored or re-implemented anything from layer 1, we'd own a fork. Backend changes would land twice — once in Xenit, once in our copy.
- `peerDependencies` keeps Xenit as the single source of truth. We pin compatible ranges and bump as Xenit evolves.

## Why externalise (vs. a single internal workspace forever)

| Choice | Pro | Con |
|---|---|---|
| **Externalised + published (target state)** | One bump propagates to all tracks + customer apps; reusable in non-navigator frontends; OSS-publishable | Release ceremony (changesets, semver, CHANGELOG); version-skew risk between consumers |
| **Internal workspace only** (current state) | Zero ceremony, atomic changes | No reuse outside this repo; out-of-tree consumers blocked |

We pay the ceremony only when the second column's pain is real. See ADR-010 for the deferral and ADR-013 for the custom-track private-repo model that makes the publish ceremony a hard prerequisite at first-customer trigger.

## Phase 4 reality (today)

- `packages/navigator-data` is a workspace package consumed via `pnpm workspace:*`.
- No semver, no CHANGELOG, no registry. Internal consumers move atomically.
- Surface is **publish-ready** — peerDeps declared, barrel exports clean, tree-shakeable. The deferred publish step (~1.5d) is mechanical when triggered.

**Trigger to publish:** first out-of-tree consumer (custom-track customer app moving out of monorepo, the ContentGrid console, or the OSS release).

## Consequences

**Positive:**
- Backend HAL contract changes propagate by Xenit version bump, not by editing every consumer.
- Navigator-side conventions (ETag, query-hook shape, config schema) have a single home.
- Workspace-protocol consumption is friction-free during the migration.
- Path to publication is short and well-defined when needed.

**Negative / accepted:**
- Two-package mental model: "is this a Xenit responsibility or ours?" — usually obvious, but adds a moment of thought when the boundary is ambiguous.
- When Xenit ships a breaking change in a layer-1 package, we may need a short-lived shim in `@contentgrid/navigator-data` until consumers catch up. That's the price of the layered model.
- Compat matrix (Xenit `@contentgrid/*` versions ↔ our `@contentgrid/navigator-data` majors) is a real artefact at publish time.

## What stays out of `@contentgrid/navigator-data`

- `packages/ui` — presentation only, no HAL knowledge. Forms renderers here read `FieldDescriptor[]`; they don't know what HAL-Forms is.
- `packages/features/*` — feature modules consume `@contentgrid/navigator-data`. They don't re-export from it.
- `apps/*` — app-level routing, layout, feature composition.

## Reconsider when

- Layer-1 packages evolve so quickly that we constantly chase Xenit. Then we may collapse layer 2 back into the monorepo or coordinate release windows formally.
- A backend redesign moves substantial responsibility into the client (e.g. "here's a JSON document, infer your own HAL semantics"). At that point the boundary moves and this ADR is replaced.

---

**Hub:** [[README|ADR Index]]
