# Quickstart: Validate Feature View Architecture

## Prerequisites

- Node.js 20 or newer
- Corepack enabled
- Dependencies installed from the committed lockfile with pnpm 11.5.2

```bash
corepack pnpm install --frozen-lockfile
```

## 1. Validate Boundary Rules

```bash
corepack pnpm --filter @contentgrid/eslint-config test
corepack pnpm lint
```

Expected: fixtures reject reverse feature imports and UI references to Navigator packages;
repository lint reports no violations.

## 2. Validate Standalone UI

```bash
corepack pnpm --filter @contentgrid/ui typecheck
corepack pnpm exec vitest run --project ui
corepack pnpm --filter @contentgrid/ui list --depth Infinity
```

Expected: UI typechecks with its local `FieldValue`, renderer tests pass, and its dependency tree
contains no `@contentgrid/navigator-data` or `@contentgrid/features`.

```bash
corepack pnpm test:storybook
corepack pnpm test:visual
corepack pnpm test:a11y
```

Expected: renderer stories, interactions, snapshots, and accessibility checks pass unchanged.

## 3. Validate Feature Contracts

```bash
corepack pnpm --filter @contentgrid/features typecheck
corepack pnpm exec vitest run --project features
```

Expected: forms/util exports typecheck; transformation characterization tests pass; app-gate tests
keep the routed view subtree unmounted until primary context is ready; component tests preserve ready
sibling content during secondary loading and errors.

## 4. Validate Both Applications

```bash
corepack pnpm --filter navigator typecheck
corepack pnpm --filter navigator-experimental typecheck
corepack pnpm test:e2e
```

Expected: both app tracks preserve routes and main-gate behavior.

Start each app separately for browser verification:

```bash
corepack pnpm dev:navigator
corepack pnpm dev:navigator-experimental
```

Verify that the app gate blocks the route subtree until profile context is ready, failures do not
mount the feature page, and independently loading regions do not hide ready page content.

## 5. Final Repository Gate

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm format:check
```

Expected: all checks pass without a lockfile change or new dependency.
