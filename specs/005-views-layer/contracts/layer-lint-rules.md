# Contract: layer lint rules

**Requirements**: FR-028, FR-029, FR-034, FR-035
**Package**: `packages/eslint-config` (PR 10)

## Layers

```
apps  ->  views  ->  features  ->  ui/patterns  ->  ui/primitives
              \-> navigator-data (all layers above ui may use it)
```

Each layer imports only from the layers below it.

## Rules

| #   | Rule                                                    | Notes                                                                                                                          |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| L1  | Apps import features only through views                 | Apps still import the data and UI packages for bootstrap (config, authentication, router context, providers). To be confirmed. |
| L2  | Features never import the router                        | The router-bound shell code (router setup) is host code and lives outside features by PR 7.                                    |
| L3  | The UI package never imports features                   | Exists in constitution Principle III today; becomes a lint rule.                                                               |
| L4  | Features never import views                             | Follows from "each layer imports from below"; keeps the graph acyclic.                                                         |
| L5  | Stable views never import experimental views            | Replaces "a stable feature never imports a candidate or experimental feature" once the tag moves (open question 1).            |
| L6  | `no-unstable-features` checks views instead of features | Generic app config: `allowedStability` stays at all three tiers pre-GA (ADR-006 amendment); the rule stays enabled.            |

## Rules for the existing stability rule

- The rule reads a package's `x-stability` field. After PR 10 the field lives on each view, and the rule resolves it for `@contentgrid/views/<name>` imports.
- The rule's options, tests and fixtures are updated with the move. At go-live the generic app returns to `["stable"]`, as the ADR-006 amendment already describes.

## Test obligations

- A fixture per rule: a file that violates it fails; a compliant file passes.
- The real repository lints clean with every rule on.
