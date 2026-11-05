# Contract: layer lint rules

**Requirements**: FR-028, FR-029, FR-034, FR-035
**Package**: `packages/eslint-config` (PR 7 of the stack)

## Layers

```
apps  ->  views  ->  features  ->  ui/patterns  ->  ui/primitives
              \-> navigator-data (all layers above ui may use it)
```

Each layer imports only from the layers below it.

## Rules

| #   | Rule                                                                        | Notes                                                                                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Apps import features only through views                                     | The design says "apps only import views"; this softened reading (apps still import the data and UI packages for bootstrap) is to be confirmed in review.                                                                                                                                                        |
| L2  | Features never import the router                                            | Views do not either. Host code in `packages/views/src/shells/` (router setup only) and the apps MAY — including each app's own `Navigation` implementation, which lives under that app's own `src/routes/`, not in `packages/views/src/shells/` (research.md §2.7). Router setup moves out of features in PR 5. |
| L3  | The UI package never imports features                                       | Exists in constitution Principle III today; becomes a lint rule.                                                                                                                                                                                                                                                |
| L4  | Features, the UI package and `navigator-data` never import `packages/views` | Follows from "each layer imports from below"; keeps the graph acyclic. Relative paths and dynamic imports count. Constitution Principle III states this for all three explicitly; a fixture per layer (features, ui, navigator-data each importing a view) is required.                                         |
| L5  | Stable views never import experimental views                                | Replaces "a stable feature never imports a candidate or experimental feature" once the tag moves (open question 1).                                                                                                                                                                                             |
| L6  | `no-unstable-views` checks views instead of features                        | Generic app config: `allowedStability` stays at all three tiers pre-GA (ADR-006 amendment); the rule stays enabled.                                                                                                                                                                                             |

## Implementation (PR 7)

- `packages/eslint-config/layers.ts` exports one config factory per package (`featuresLayerConfig`, `viewsLayerConfig`, `uiLayerConfig`, `navigatorDataLayerConfig`) plus `appsViewsOnly(pendingViewFeatures)` and `restrictSources(...)` for the apps, imported as `@contentgrid/eslint-config/layers` by each package's own `eslint.config.js`. `plugin.ts` (`@contentgrid/eslint-config/plugin`) registers the repo's rules under one `@contentgrid` namespace; ESLint rejects two different plugin objects under one name, so every config uses this one.
- L1 to L4 are the repo's `@contentgrid/no-restricted-sources` rule, not core `no-restricted-imports`: the core rule ignores `import("x")` and `typeof import("x")`, and its patterns cannot see a relative path into another package (`../../../views/src/layout`). The repo rule checks `import`, `export ... from`, `import()`, `import x = require()` and `import("x")` types, matches the specifier as written, and for relative specifiers also the path they resolve to (so a file never matches a restriction on its own package). L2 covers `@tanstack/react-router`, its subpaths and `-devtools`-style siblings, `@tanstack/router-*` and `@tanstack/history`.
- L5 is the repo's `view-stability-order` rule (`@contentgrid/view-stability-order`): a view may import only views at least as stable as itself (experimental < candidate < stable), relative imports, re-exports and dynamic `import()` included. Code in `packages/views/src` with no tag of its own (support folders, the root barrel `src/index.ts`) counts as `stable`, so it cannot import or re-export a less stable view; the root barrel exports navigation infrastructure only, never a view. L6 is `no-unstable-views` (renamed from `no-unstable-features`), which also checks `export ... from`.
- **L1 transitional allowlist.** Four features are imported by the apps directly because no view wraps them yet: `app-info-pages`, `entity-item-create`, `preferences`, `search`. The list (`PENDING_VIEW_FEATURES`) is owned by each app and lives in its `eslint.config.js` (both identical), not in the shared package. An entry goes away when its view lands; a new entry needs an amendment here. At go-live the list must be empty, or each remaining feature audited (ADR-006 amendment go-live steps; task T063, owner to be assigned). `preferences` stays listed because the feature still exists and the apps import it (the user-preferences work is deferred). Since a feature carries no stability tag, these imports are not stability-checked (L6).
- **L2 exemption.** The unsaved-changes guard hook (`unsaved-changes-guard/use-unsaved-changes-guard.ts`; spec 005 leaves its home out of scope) and the three feature tests that mount it inside a router, plus the guard's own test, are exempt from L2 only (`ROUTER_EXEMPT` in `packages/features/eslint.config.js`); L4 still applies to them. Until the guard moves, "no feature imports the router" (SC-007) holds for everything except that list.

## Rules for the existing stability rule

- The rule reads a package's `x-stability` field. After this PR the field lives on each view, and the rule resolves it for `@contentgrid/views/<name>` imports.
- The rule's options, tests and fixtures are updated with the move. At go-live the generic app returns to `["stable"]`, as the ADR-006 amendment already describes.

## Test obligations

- A fixture per rule: a file that violates it fails; a compliant file passes.
- The real repository lints clean with every rule on.
