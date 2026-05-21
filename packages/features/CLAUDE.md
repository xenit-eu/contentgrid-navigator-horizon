# packages/features — CLAUDE.md

Package: `@contentgrid/features` (private — not published to npm)
Purpose: Feature modules for the Navigator. Each feature carries an explicit
stability flag that controls which app tracks can import it. Features are the
unit of promotion between tracks.

Platform-wide conventions: see root [`CLAUDE.md`](../../CLAUDE.md).
Three-track model: [ADR-006](../../docs/adr/ADR-006-three-track-delivery-model.md).

---

## Directory layout

```
packages/features/
  src/
    <feature-name>/       # one directory per feature
      package.json        # MUST contain "x-stability" field
      index.ts            # public API of the feature
      ...
  index.ts                # barrel (re-exports stable features; subject to track rules)
```

Each feature is a subdirectory under `src/`. Features are NOT separate workspace
packages — they share the `@contentgrid/features` package and are distinguished
by subdirectory path.

---

## x-stability flag

([ADR-006](../../docs/adr/ADR-006-three-track-delivery-model.md))

Every feature directory MUST have a `package.json` containing an `x-stability`
field. Allowed values (exact strings):

```
"x-stability": "experimental"
"x-stability": "candidate"
"x-stability": "stable"
```

Promotion path:

```
experimental → candidate → stable
```

Rules:

- A new feature starts at `"experimental"`.
- The field must be present. Omitting it is a lint error (HZN-1.9, not yet wired).
- Do NOT use any value other than the three listed above.
- The generic build (`apps/navigator`) enforces that it imports only `stable`
  features via an ESLint rule (HZN-1.9). This enforcement is not yet wired;
  until it is, contributors must enforce it manually.
- The CI bundle audit fails the generic build if `experimental` or `candidate`
  feature code appears in the generic bundle (HZN-1.9, not yet wired).

---

## Promotion workflow

([ADR-006](../../docs/adr/ADR-006-three-track-delivery-model.md),
[migration roadmap](../../docs/contentgrid-navigator-migration-roadmap.md))

Promotion = a PR that:

1. Flips `x-stability` in the feature's `package.json`
   (e.g. `"experimental"` → `"candidate"`, or `"candidate"` → `"stable"`).
2. For promotion to `stable`: adds the feature to `apps/navigator`'s import
   allowlist (once HZN-1.9 lint enforcement is wired).

No code moves between directories. No fork drift. The feature code stays in
`packages/features/<name>/`.

**Dependency check before opening a promotion PR:**
Run `pnpm --filter <feature> exec contentgrid-stability check` (or inspect the
transitive `x-stability` graph manually) to confirm all dependencies of the
feature are at or above the target stability tier. A feature cannot be `stable`
if any of its dependencies are `experimental` or `candidate`. This check is
graph-aware — work through the full dependency chain, not just direct deps.

Note: `contentgrid-stability check` is the planned CLI (referenced in ADR-006).
It is not yet implemented as of the current phase; do the graph check manually
until HZN-1.9 wires it.

---

## What belongs in a feature vs. in packages/ui or packages/navigator-data

- If a component is only used in ONE feature → it lives inside
  `packages/features/<feature>/`, not in `packages/ui`.
- If a component is reused across multiple features or tracks → it belongs in
  `packages/ui/src/patterns/`.
- If logic touches HAL, ETags, or TanStack Query hooks → it belongs in
  `packages/navigator-data`, not in the feature.

---

## peerDep policy

Features consume `packages/ui` and `packages/navigator-data` via the workspace
protocol. React and react-dom are inherited as peerDeps. Do not declare
`@contentgrid/hal` or other Layer-1 packages as direct deps in a feature — go
through `@contentgrid/navigator-data` instead.

---

## Forbidden imports

- Do NOT import from `apps/*`.
- Do NOT import `@contentgrid/hal`, `@contentgrid/hal-forms`, or other
  `@contentgrid/*` Layer-1 packages directly. Use the hooks and types exported
  from `@contentgrid/navigator-data`.
- Do NOT import a `candidate` or `experimental` feature from within a feature
  that is itself `stable` (that would break the dependency chain invariant).
