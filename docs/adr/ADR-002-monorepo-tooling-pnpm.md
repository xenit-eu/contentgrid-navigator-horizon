# ADR-002 — Monorepo tooling: pnpm workspaces only

**Date:** 2026-04-29
**Status:** Accepted
**Phase:** 0 — Alignment & decisions

---

## Context

The modernised navigator ships from a monorepo (generic + experimental apps today; custom-track apps later). We need a workspace tool that handles cross-package linking, dependency hoisting, and consistent installs. Three realistic options on the table: pnpm workspaces alone, Nx, Turborepo.

The repo at Phase 1 is two apps + a handful of packages. Future state is bounded: ~3–5 apps and ~5–8 packages. Build times are not yet a known pain point.

## Decision

**Use pnpm workspaces only.** No Nx. Turborepo deferred until measured CI pain.

- `pnpm-workspace.yaml` defines workspace globs.
- `workspace:*` protocol for internal dependencies.
- Per-package `package.json` scripts; root `package.json` orchestrates via `pnpm -r run <script>` and `--filter`.
- Root `package.json` pins the pnpm version via `"packageManager": "pnpm@<x.y.z>"` to prevent local/CI version drift.
- A 5-minute CI no-op-PR threshold is the trigger to revisit Turborepo.
- Nx is rejected outright — not deferred.

## Affected-run strategy (built-in, pre-Turborepo)

The "no automatic affected-detection" caveat in Consequences is mitigated by pnpm's own changed-since selector. Before reaching for Turborepo, use:

```
pnpm --filter "...[origin/main]" run test
pnpm --filter "...[origin/main]" run build
```

This runs the target only on workspaces changed since `origin/main` _plus_ their dependents — the same blast-radius semantics as Turborepo's `--filter=...[origin/main]` for affected runs, without adopting a second tool. CI uses this for PR builds; only when this strategy itself hits the 5-minute threshold (e.g. broad cross-package changes dominate) does Turborepo's task-level caching become the next lever.

## Why pnpm alone

- Already knows how to do disk-efficient installs, workspace symlinking, and dependency hoisting controls. Solves 95% of monorepo pain at zero additional cost.
- Native to the prototype's existing tooling — no migration cost.
- Tree-shakeable mental model: every developer who knows npm/yarn already understands pnpm in an afternoon.

## Why Nx is rejected (not just deferred)

- Adds a second mental model on top of pnpm: project graph, executors, generators, target dependencies, cache configuration. That's a second thing every contributor must learn before they can ship.
- The payoff (smart task scheduling, affected-detection, generators) only matters at ~5+ apps with non-trivial inter-dependencies. We're not there and won't be for the foreseeable horizon.
- Nx-shaped code (`project.json`, `nx.json`, executor configs) is a tax that any future OSS consumer pays just to read the repo. Hurts the eventual Apache-2.0 release.
- Migration cost is non-trivial; reversal cost is higher.

## Why Turborepo is deferred (not adopted, not rejected)

- Solves one real problem — task-level caching and parallelism — without imposing a project-graph mental model.
- But: at our scale today, vanilla pnpm `--filter` + GitHub Actions caching covers the same ground. Turborepo's leverage shows up when CI runs hit ~5+ minutes on no-op PRs and developers feel it.
- **Adoption trigger:** CI no-op PR build time crosses 5 minutes consistently, _or_ `pnpm test` on a typo-only change exceeds ~30s locally.
- When triggered, Turborepo sits _alongside_ pnpm — it doesn't replace anything. Migration is additive.

## Consequences

**Positive:**

- One tool to learn. New contributors are productive on day one.
- OSS consumers see a vanilla pnpm setup — no proprietary configuration to decode.
- Reversibility is high — switching to Turborepo later is additive, not a rewrite.

**Negative / accepted:**

- No automatic affected-detection. CI runs every package's tests on every PR until we add filtering manually.
- No remote build cache. Acceptable at our build times today.
- If/when CI time crosses the threshold, there's a small migration cost to add Turborepo. Budgeted as "later" rather than now.

## Vulnerability-patching parity with Yarn

This was raised as a migration concern: does pnpm have equivalent coverage to the Yarn `resolutions` field the existing navigator already relies on? Full parity, plus additional capability:

- **`pnpm.overrides`** in `package.json` — direct equivalent of Yarn `resolutions`. Supports plain version pinning, parent-scoped selectors (`parent>child`), version-range selectors (e.g. `minimatch@<3.0.5`), and nested overrides. `pnpm audit` respects them. Every case covered by Yarn `resolutions` is covered here.
- **`pnpm patch <pkg>@<version>` / `pnpm patch-commit`** — generates a `.patch` file checked into the repo and automatically re-applied on install. Use when no fixed version exists upstream and a local hot-fix is needed on the package source. Yarn 1 has no native equivalent (Berry adds the `patch:` protocol, but the existing navigator uses Yarn 1).
- **`pnpm.allowedDeprecatedVersions`** and **`pnpm.packageExtensions`** — finer-grained transitive-dep control than Yarn 1 offers: `allowedDeprecatedVersions` silences specific deprecation warnings for pinned transitives; `packageExtensions` lets you add missing `peerDependencies` or patch `exports` fields without forking the package.

Net: pnpm matches Yarn on `resolutions` parity (`pnpm.overrides`) and is strictly ahead on patching unreleased fixes (`pnpm patch`). The vulnerability-patching capability is not a reason to stay on Yarn.

## Reconsider when

- CI no-op PR time exceeds 5 minutes → adopt Turborepo (not Nx).
- We grow past 5 distinct apps with overlapping build graphs → re-evaluate Nx, but only with a measured pain point as evidence.
- OSS consumers report friction with the workspace setup → revisit, but pnpm is widely understood.

---

**Hub:** [[README|ADR Index]]
