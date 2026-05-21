# contentgrid-navigator-horizon

Monorepo for the modernised ContentGrid Navigator front-end. The navigator is a React SPA that renders a generic, content-model-aware UI over the ContentGrid HAL/HAL-Forms API. It ships in three coordinated tracks — generic (production), experimental (internal preview), and custom (per-customer) — from a single codebase. See ADR-006 for the full rationale.

---

## Repo layout

```
contentgrid-navigator-horizon/
├── apps/
│   ├── navigator/              Generic track — production build, stable features only
│   └── navigator-experimental/ Experimental track — internal preview, all stability tiers
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

`packages/features/` is where self-contained UI features live, each carrying an `x-stability` flag in its `package.json`. The three tiers are `experimental → candidate → stable`. The generic app may only import `stable` features (enforced by ESLint + CI bundle audit). The experimental app may import all tiers. Promotion — moving a feature to a higher tier — is done by flipping the flag and adding the feature to the generic allowlist in a PR; no code moves between apps. This package is currently scaffolded with an empty barrel export (`src/index.ts`); features will be added as the migration progresses.

### What is in `packages/navigator-data`?

A composition layer (Layer 2) that wires together the seven Xenit `@contentgrid/*` core packages (Layer 1: `@contentgrid/hal`, `hal-forms`, `typed-fetch`, `fetch-hooks`, `fetch-hook-authentication`, `problem-details`, `uri-template`). It provides TanStack Query hooks, ETag/`If-Match` optimistic-concurrency policy, the HAL-Forms→`FieldDescriptor[]` bridge, Zod-validated app config, and MSW handler fixtures. It does not re-implement anything from Layer 1. Currently consumed via `pnpm workspace:*`; publish ceremony is deferred until the first out-of-tree consumer (ADR-007).

---

## Apps: navigator vs. navigator-experimental

Both apps have identical dependencies, tooling (Vite + TanStack Router file-based routing, React 19, TypeScript), and build scripts. The difference is intentional and structural, not accidental:

|                                 | `apps/navigator`                                                            | `apps/navigator-experimental`                                        |
| ------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Dev port                        | 5173                                                                        | 5174                                                                 |
| Deployment target               | Public production                                                           | Internal-only, auth-gated preview environment — never a public URL   |
| Feature stability tiers allowed | `stable` only (lint + bundle audit enforced)                                | `stable` + `candidate` + `experimental`                              |
| Purpose                         | Robust default UI for any ContentGrid content model; drives the OSS release | Customer demos, in-flight ideas, features not yet promoted to stable |

The lint rule and CI bundle audit that enforce the stability boundary are planned as part of phase HZN-1.9 and are not yet wired. Until they are, the split is structural (separate Vite entry points on separate ports) but not yet machine-enforced at the import level.

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

There are no `test` or `lint` scripts in any `package.json` yet; those will be added as the migration progresses.

---

## Build modes

### Generic build (`apps/navigator`)

```bash
pnpm dev:navigator        # dev server on port 5173
pnpm --filter navigator build  # production build (tsc -b && vite build)
```

This is the production track. When feature stability enforcement is wired (HZN-1.9), importing a non-`stable` feature here will fail at lint time and the CI bundle audit will catch any that slip through. Until then, the separation is by convention.

### Experimental build (`apps/navigator-experimental`)

```bash
pnpm dev:navigator-experimental        # dev server on port 5174
pnpm --filter navigator-experimental build  # production build (tsc -b && vite build)
```

This is the internal preview track. It runs on a separate port and is deployed to an auth-gated environment. It is allowed to import features at any stability tier. It must never be exposed at a public URL.

---

## Open questions

- **Stability enforcement not yet active.** The ESLint rule and CI bundle audit that enforce the `stable`-only boundary in `apps/navigator` are planned (HZN-1.9) but not yet implemented. The apps are structurally separate but the import boundary is not machine-enforced today.
- **`packages/features/` is empty.** No features have been added yet. The package exists as a scaffold; its shape (per-feature subdirectory, `x-stability` in `package.json`) is described in ADR-006 but not yet built out.
- **No test or lint scripts.** Neither root nor app `package.json` files define `test` or `lint` scripts yet. These will appear as the migration phases proceed.
- **Custom track not scaffolded.** `apps/<customer>/` directories do not exist yet. Custom-track scaffolding is deferred to Phase 8 (ADR-010, ADR-013).
