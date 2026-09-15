# Contract: Standalone ContentGrid UI

## Package Boundary

`@contentgrid/ui` must install, typecheck, render, and build without:

- `@contentgrid/navigator-data`
- `@contentgrid/features`
- either Navigator application
- any Layer-1 ContentGrid HAL package

These packages do not appear in UI's dependencies, peer dependencies, development dependencies,
source imports, or transitive runtime graph.

## Presentation Values

UI controls and patterns accept plain values and callbacks. The shared renderer value contract is:

```ts
export type FieldValue = string | number | boolean | Date | File | undefined;
```

Feature adapters map domain and form values into this contract before rendering. UI does not receive
HAL templates, profile accessors, query results, or feature field descriptors.

## Public Surface

`FieldValue` is exported from the root UI barrel with primitives, patterns, styles, and tokens.
Standalone consumers supply their own data access, routing, state management, and authentication.

## Enforcement

- A package-scoped ESLint rule rejects forbidden UI imports.
- A manifest test rejects forbidden package entries.
- A graph check rejects direct or transitive Navigator package paths.
- UI type, unit, story, visual, and accessibility checks run without Navigator packages in UI source.
