# packages/dev-tools — CLAUDE.md

Package: `@contentgrid/dev-tools` (private — not published to npm)
Purpose: Shared DEV-ONLY tooling composed on top of `@contentgrid/ui` and
`@contentgrid/navigator-data` — currently the Application Selector, which lets
a developer repoint Navigator at an arbitrary backend / OIDC issuer.

Platform-wide conventions: see root [`CLAUDE.md`](../../CLAUDE.md).

---

## Why this is not `packages/features`

This package is Layer-2 composition just like `packages/features`, but it is
explicitly **NOT a promotable product feature**:

- No `x-stability` flag — there is no promotion path to `stable`, because this
  code must never reach production regardless of track.
- No per-component `package.json` stub — components here are not units of
  promotion, just shared dev tooling.

## Production safety

Consumers MUST gate every import from this package behind a dev-only check
(e.g. `import.meta.env.DEV`) so bundlers tree-shake it out of production
builds. See `apps/navigator/src/routes/config.tsx` for the reference pattern.
