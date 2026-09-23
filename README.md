# contentgrid-navigator-horizon

Monorepo for the modernised ContentGrid Navigator front-end. The navigator is a React SPA that renders a generic, content-model-aware UI over the ContentGrid HAL/HAL-Forms API. It ships in three coordinated tracks — generic (production), experimental (internal preview), and custom (per-customer) — from a single codebase. See ADR-006 for the full rationale.

---

## Repo layout

```
contentgrid-navigator-horizon/
├── apps/
│   ├── navigator/              Generic track — production build, stable features only
│   ├── navigator-experimental/ Experimental track — internal preview, all stability tiers
│   └── storybook/              Storybook host + Playwright visual-regression harness (ADR-009)
│
├── packages/
│   ├── features/               Feature modules with per-feature stability flags (ADR-006)
│   ├── navigator-data/         Composition layer over @contentgrid/* core packages (ADR-007)
│   ├── ui/                     Shared React component library (Tailwind v4 + shadcn/ui)
│   ├── tsconfig/               Shared TypeScript base config
│   └── eslint-config/          Shared ESLint flat config
│
├── docs/
│   ├── adr/                    Architecture Decision Records (ADR-001 through ADR-015)
│   ├── contentgrid-navigator-migration-analysis.md
│   └── contentgrid-navigator-migration-roadmap.md
│
├── package.json                Root workspace scripts
└── pnpm-workspace.yaml         Workspace definition (apps/*, packages/*)
```

---

## Where things live

| What                    | Where                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| Architecture principles | Project `.claude/settings.local.json`; public docs at docs.contentgrid.com     |
| Architecture decisions  | `docs/adr/` — 15 ADRs, each with context, decision, alternatives, consequences |
| Migration roadmap       | `docs/contentgrid-navigator-migration-roadmap.md`                              |
| Migration analysis      | `docs/contentgrid-navigator-migration-analysis.md`                             |
| Shared features         | `packages/features/` — see below                                               |
| Shared UI components    | `packages/ui/src/`                                                             |
| Data / API layer        | `packages/navigator-data/src/`                                                 |
| TypeScript base config  | `packages/tsconfig/tsconfig.base.json`                                         |
| ESLint config           | `packages/eslint-config/index.js`                                              |

### What is a "feature"?

`packages/features/` is where self-contained UI features live, each carrying an `x-stability` flag in its `package.json`. The three tiers are `experimental → candidate → stable`. The generic app's import boundary is enforced by an ESLint rule (CI bundle audit still pending); pre-GA that rule is configured to allow all tiers, so the generic app may import any tier until go-live, when it reverts to `stable`-only. The experimental app may always import all tiers. Promotion — moving a feature to a higher tier — is done by flipping the flag in a PR; no code moves between apps. See [ADR-006](docs/adr/ADR-006-three-track-delivery-model.md) for the pre-GA amendment.

### What is in `packages/navigator-data`?

A composition layer (Layer 2) that wires together the seven Xenit `@contentgrid/*` core packages (Layer 1: `@contentgrid/hal`, `hal-forms`, `typed-fetch`, `fetch-hooks`, `fetch-hook-authentication`, `problem-details`, `uri-template`). It provides TanStack Query hooks, ETag/`If-Match` optimistic-concurrency policy, the HAL-Forms→`FieldDescriptor[]` bridge, Zod-validated app config, and MSW handler fixtures. It does not re-implement anything from Layer 1. Currently consumed via `pnpm workspace:*`; publish ceremony is deferred until the first out-of-tree consumer (ADR-007).

---

## Apps: navigator vs. navigator-experimental

Both apps have identical dependencies, tooling (Vite + TanStack Router file-based routing, React 19, TypeScript), and build scripts. The difference is intentional and structural, not accidental:

|                                 | `apps/navigator`                                                                                 | `apps/navigator-experimental`                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Dev port                        | 5173                                                                                             | 5174                                                                 |
| Deployment target               | Public production                                                                                | Internal-only, auth-gated preview environment — never a public URL   |
| Feature stability tiers allowed | `stable` + `candidate` + `experimental` (pre-GA; lint-enforced `stable` only resumes at go-live) | `stable` + `candidate` + `experimental`                              |
| Purpose                         | Robust default UI for any ContentGrid content model; drives the OSS release                      | Customer demos, in-flight ideas, features not yet promoted to stable |

The ESLint rule that enforces the stability boundary is wired (`apps/navigator/eslint.config.js`); pre-GA it's configured to allow all tiers, so it currently only catches an invalid/typo `x-stability` value. The CI bundle audit (HZN-1.9) is still not wired. The `stable`-only boundary is restored at production go-live — see [ADR-006](docs/adr/ADR-006-three-track-delivery-model.md).

Both apps use `TanStackRouterVite` for file-based route generation (`src/routes/` → `src/routeTree.gen.ts`). The root route and index route are currently placeholder stubs.

---

## Getting started

```bash
# Install all workspace dependencies
pnpm install

# Run the generic app (port 5173)
pnpm dev:navigator

# Run the experimental app (port 5174)
pnpm dev:navigator-experimental

# Build all packages and apps
pnpm build

# Type-check all packages and apps (no emit)
pnpm typecheck

# Lint all packages and apps (ESLint)
pnpm lint

# Check formatting (Prettier)
pnpm format:check

# Run Storybook (component workbench, port 6006)
pnpm storybook
```

To work on a specific app directly:

```bash
# From the repo root, scoped to one app
pnpm --filter navigator dev
pnpm --filter navigator-experimental dev
pnpm --filter navigator build

# Preview a production build
pnpm --filter navigator preview
pnpm --filter navigator-experimental preview
```

ESLint (`lint`) and Prettier (`format` / `format:check`) scripts exist in every package and run in CI, and visual-regression tests exist for `packages/ui` (see [Testing](#testing)). There are no unit or integration `test` scripts yet — the root `pnpm test` and `pnpm test:e2e` are `--if-present` pass-throughs that currently match nothing; those land as the migration progresses.

---

## Testing

### Visual regression (`packages/ui`)

Playwright captures one full-page screenshot per Storybook story and diffs it against a committed baseline (ADR-009).

```bash
# Build Storybook and run the snapshot suite
pnpm test:visual

# Re-generate baselines after an intentional UI change
pnpm test:visual:update
```

Baselines live in `apps/storybook/tests/__snapshots__/` and **must only be (re)generated inside the pinned Playwright Docker image** (`mcr.microsoft.com/playwright:v1.60.0-noble`), never on macOS — local font rendering differs and produces spurious diffs. CI runs the same suite in that image via the `visual` job in `.github/workflows/ci.yml`. See ADR-009 for the determinism rules and threshold rationale.

---

## Build modes

### Generic build (`apps/navigator`)

```bash
pnpm dev:navigator        # dev server on port 5173
pnpm --filter navigator build  # production build (tsc -b && vite build)
```

This is the production track. The stability ESLint rule is wired but suspended pre-GA (configured to allow all tiers); at go-live it reverts to `stable`-only and importing a non-`stable` feature will fail at lint time. The CI bundle audit (HZN-1.9) that will backstop this at build time is not yet wired.

### Experimental build (`apps/navigator-experimental`)

```bash
pnpm dev:navigator-experimental        # dev server on port 5174
pnpm --filter navigator-experimental build  # production build (tsc -b && vite build)
```

This is the internal preview track. It runs on a separate port and is deployed to an auth-gated environment. It is allowed to import features at any stability tier. It must never be exposed at a public URL.

---

## Open questions

- **Stability gate suspended pre-GA.** The ESLint rule that enforces the `stable`-only boundary in `apps/navigator` is wired but currently configured to allow all tiers while the product is pre-GA (see [ADR-006](docs/adr/ADR-006-three-track-delivery-model.md)); the CI bundle audit (HZN-1.9) that would backstop it is still not implemented. The `stable`-only boundary is restored at production go-live.
- **`packages/features/` is populated.** Feature modules already live under `packages/features/src/` (e.g. `entity-item`, `search`, `dashboard`), each carrying an `x-stability` flag per ADR-006.
- **No unit/integration tests yet.** Lint, formatting, and visual-regression (`packages/ui`) checks run in CI, but no unit or integration `test` scripts are implemented — `pnpm test` and `pnpm test:e2e` are `--if-present` pass-throughs that currently match nothing. These land as the migration phases proceed.
- **Custom track not scaffolded.** `apps/<customer>/` directories do not exist yet. Custom-track scaffolding is deferred to Phase 8 (ADR-010, ADR-013).
