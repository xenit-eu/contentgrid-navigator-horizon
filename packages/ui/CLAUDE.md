# packages/ui — CLAUDE.md

Package: `@contentgrid/ui`
Purpose: Shared UI component library. Contains shadcn primitives (owned copies) and
Amexio/Navigator patterns composed from them. Consumed by all three tracks
(generic, experimental, custom) via `pnpm workspace:*`.

Platform-wide conventions (HAL, ABAC, auth, error types): see root [`CLAUDE.md`](../../CLAUDE.md).

---

## Directory layout

```
packages/ui/src/
  primitives/    # shadcn/ui components, copied-in and owned by us
  patterns/      # composed Navigator-domain components built on primitives
  index.ts       # barrel — every public export goes here
```

---

## Primitive vs. pattern boundary

Source: [ADR-003](../../docs/adr/ADR-003-ui-stack-tailwind-shadcn.md).

- **Primitive** — a low-level, generally reusable UI building block derived from
  shadcn/ui (backed by Radix UI). Lives in `src/primitives/`. Examples:
  `button`, `dialog`, `input`, `select`, `table`.
  - No Navigator-domain knowledge. No HAL types. No entity concepts.
  - Radix UI is consumed ONLY inside `packages/ui` — apps and other packages
    must not import Radix directly.
- **Pattern** — a composed component that encodes Navigator-domain semantics.
  Lives in `src/patterns/`. Examples: `EntityCard`, `DataTable`,
  `FilterSidebar`, HAL-Forms field renderers, `PdfHighlightOverlay`.
  - The HAL-Forms field renderers (`src/patterns/form-renderers/`) take plain scalar props
    (`name`, `label`, `required`, `readOnly`, `description?`, `value`, `onChange`, `error?`,
    plus type-specific constraints like `includesTime`/`options`) — NOT a descriptor object.
    The `kind`-dispatching switch and the `FieldDescriptor` type itself live in
    `packages/features/src/entity-item-create/` (ADR-004), not here; these components have no
    dependency on that type or on any HAL-Forms shape, and do NOT import `@contentgrid/hal` or
    `@contentgrid/hal-forms` directly.
  - If a pattern is only used in one feature, it belongs in
    `packages/features/<feature>/`, NOT here. The registry is for patterns
    reused across multiple tracks or apps.

---

## shadcn-CLI usage

Rule: run `pnpm shadcn add <component>` directly. Do NOT use a wrapper script.
([ADR-012](../../docs/adr/ADR-012-no-shadcn-cli-wrapper.md))

Why: wrapper CLIs go stale on shadcn upstream bumps; conventions belong in lint
and code review, not in a vendor-intercepting tool.

**To add an upstream shadcn primitive:**

```
pnpm --filter @contentgrid/ui shadcn add button
```

Then follow the post-add checklist (see below).

**To add a ContentGrid pattern from the CG registry:**

```
pnpm shadcn add @contentgrid/entity-card
```

Same command, different registry source. No extra scaffolding needed for
registry entries.

**To write a new pattern locally** (not from registry):

```
# write packages/ui/src/patterns/<kebab-case-name>.tsx
# write packages/ui/src/patterns/<kebab-case-name>.stories.tsx
# add export to packages/ui/src/index.ts
```

No CLI involved.

**Post-add checklist for primitives:**

- File name: `kebab-case.tsx` in `src/primitives/`.
- Export name: `PascalCase`, re-exported from `src/index.ts`.
- Story: `<name>.stories.tsx` alongside the component (ADR-009).
- Lint catches missing barrel exports and missing stories in CI.

---

## Naming conventions

- Files: `kebab-case.tsx` / `kebab-case.stories.tsx`.
- Exported components: `PascalCase`.
- Hooks inside `packages/ui`: `usePascalCase` — but prefer keeping hooks in
  `packages/navigator-data` if they touch HAL or server state.

---

## Forbidden imports

- Do NOT import from `apps/*`. This is a shared package.
- Do NOT import `@contentgrid/hal`, `@contentgrid/hal-forms`,
  `@contentgrid/typed-fetch`, `@contentgrid/fetch-hooks`,
  `@contentgrid/fetch-hook-authentication`, `@contentgrid/problem-details`,
  or `@contentgrid/uri-template` — those belong in `packages/navigator-data`.
  The form-renderer patterns take plain scalar props (see above), not a `FieldDescriptor` or any
  other HAL-Forms-shaped type — that type lives in `packages/features/src/entity-item-create/`.
- Do NOT import from `packages/features/*` — features depend on `packages/ui`,
  not the other way around.
- Do NOT import Radix UI (`@radix-ui/*`) outside `packages/ui`. Inside
  `packages/ui`, Radix is fine — it underpins the primitives.

---

## HAL-FORMS metadata in pattern components

Per ADR-004, `packages/ui`'s form-renderer patterns
(`src/patterns/form-renderers/`) are **descriptor-agnostic**: they never see a `FieldDescriptor`,
a `HalFormsProperty`, or any other HAL-Forms-shaped value. The `kind` switch that reads a
`FieldDescriptor` and unpacks it into plain props lives in
`packages/features/src/entity-item-create/render/field-renderer.tsx`, one layer up.

- Each renderer takes plain scalar props only: `name`, `label`, `required`, `readOnly`,
  `description?`, `value`, `onChange`, `error?`, plus type-specific constraints
  (`includesTime` for datetime, `options`/`isRemote` for enum, `min`/`max`/`step` for number,
  etc.). Do NOT reintroduce a descriptor-object prop (`field: SomeDescriptorType`) — that was the
  exact coupling this restructure removed. A caller unpacks its own descriptor type into these
  props before rendering.
- `enum`/`enum-multi` renderers take already-resolved `options: readonly string[]` plus an
  `isRemote?: boolean` flag for "not yet loaded" — they never see a raw HAL-FORMS options object
  or resolve a remote `options.link` themselves.
- Remote option FETCHING stays out of `packages/ui`, unchanged: the caller (in
  `packages/features`) decides `isRemote` and supplies already-resolved `options` once loaded.
- The one exception where a `packages/ui`-adjacent renderer needs live data —
  `RelationToOneRenderer`/`RelationToManyRenderer` needing a target collection's candidates —
  is solved by keeping the actual fetch (`render/relation-field.tsx`, using
  `useEntityItemCollection`) in `packages/features`, one layer above these dumb renderers; the
  renderers themselves still only receive an already-fetched `options: EntityPickerOption[]` list
  plus pagination callbacks.
- Why: `packages/ui` is the rendering layer; data fetching and HAL-Forms-shaped state belong in
  `packages/navigator-data`/`packages/features`. Mixing them violates the two-layer model
  (ADR-007) and would pull Layer-1 packages into the UI bundle.

---

## peerDep policy

`react` and `react-dom` are `peerDependencies`. Do not move them to
`dependencies`. For the full rationale see
[ADR-007](../../docs/adr/ADR-007-two-layer-dependency-model.md) and
[`packages/navigator-data/CLAUDE.md`](../navigator-data/CLAUDE.md).
