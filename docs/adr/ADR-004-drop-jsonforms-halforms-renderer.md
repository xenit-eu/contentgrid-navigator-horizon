# ADR-004 — Forms: drop JSONForms; HAL-Forms → `FieldDescriptor`/`FieldRenderer` architecture

**Date:** 2026-04-29
**Status:** Accepted
**Phase:** 0 — Alignment & decisions

---

## Context

The original navigator uses JSONForms v3.6.0 (pinned exact) with eight custom renderers to drive entity edit/create forms. The prototype replaced this with a custom `useFormFields` hook and shadcn-native fields, but currently ignores HAL-Forms `_templates` entirely — driving forms from profile metadata instead. That's a real correctness bug (server-controlled form semantics are lost).

Backend already publishes `@contentgrid/hal-forms`, which parses `_templates` into a typed `HalFormsTemplate` / `HalFormsProperty` structure. So the heavy parsing work is already done upstream by Xenit.

**This ADR was first accepted with a bridge shaped as `HalFormsTemplate` → `RenderFieldDescriptor[]`**, split across `packages/navigator-data/src/form-fields/` (the bridge + `useFormFields`) and `packages/ui/src/patterns/form-renderers/` (a `FieldRenderer` switch dispatching to per-type renderers). That implementation shipped and worked, but coupled two things that don't actually belong together:

- **Model enrichment** — "what the backend requires" (required-ness, constraints, relation cardinality) — is a `packages/navigator-data` concern; it doesn't change per rendering surface.
- **Rendering projection** — "how it renders" (which widget, how errors display, how a relation picker fetches its candidates) — is a presentation concern that needs to evolve independently (new field kinds, new error UX, an eventual AI-extraction annotation layer) without touching the data layer.

This ADR splits these into a dedicated rendering-projection engine — a `FieldDescriptor` union, `resolveFieldDescriptors()`, a `kind`-aware `FieldRenderer`, `LayoutInformation`, and a `FormContainer` — with dumb widgets staying in `packages/ui`, decoupled from any specific descriptor type.

## Decision

**Drop the old `RenderFieldDescriptor` bridge. Adopt a `FieldDescriptor`/`FieldRenderer`/`FieldError` architecture, split across three packages by responsibility, not by feature.**

```
packages/navigator-data          Layer 2 — model enrichment ("what the backend requires")
  CreateHalFormTemplate, ProfileAttribute, ProfileRelation, HalFormsProperty (re-exported type)
  — unchanged by this restructure; still the source `resolveCreateFieldDescriptors` reads from.

packages/features/src/entity-item-create   Rendering-projection engine (moved here — see
                                            "Where the engine lives" below)
  model/    FieldDescriptor union, LayoutInformation, resolveCreateFieldDescriptors()  (pure)
  state/    FieldError taxonomy, useEntityFormState()                                  (state)
  render/   FieldRenderer (kind switch), relation-field.tsx, FormContainer             (render)

packages/ui/src/patterns/form-renderers    Layer — dumb widgets
  TextRenderer, NumberRenderer, BooleanRenderer, DateTimeRenderer, EnumRenderer,
  EnumMultiRenderer, RelationToOneRenderer, RelationToManyRenderer
  — plain scalar props (name, label, required, readOnly, value, onChange, error, ...);
    no dependency on any descriptor type, HAL, or HAL-Forms.
```

- **`FieldDescriptor`** (`packages/features/src/entity-item-create/model/field-descriptor.ts`) is a `kind`-discriminated union (`text`, `number`, `datetime`, `boolean`, `file`, `enum`, `relation`). Every variant carries the raw `HalFormsProperty` (re-exported as a type from `@contentgrid/navigator-data`, never imported from `@contentgrid/hal-forms` directly) alongside its own typed fields — unlike the old `RenderFieldDescriptor`, nothing needs pre-flattening into a lossy subset before a renderer can use it.
- **`resolveCreateFieldDescriptors()`** (`model/resolve-create-field-descriptors.ts`) is a pure function: `CreateHalFormTemplate` → `{ fields, layout }`. No React, no fetching — a direct, same-shaped replacement for the retired `create-form-to-render-fields.ts`.
- **`FieldRenderer`** (`render/field-renderer.tsx`) is the `kind` switch, now living in `packages/features` rather than `packages/ui`. This is the one deliberate exception: `packages/ui` cannot fetch (see its CLAUDE.md), but a `relation` field's picker needs to fetch its target collection via `@contentgrid/navigator-data` hooks (`render/relation-field.tsx`). Every other `kind` delegates straight through to a `packages/ui` widget.
- **`FieldError`** (`state/field-error.ts`) replaces the old flat `Record<string, string>` with a two-source taxonomy — `{ source: "internal" | "external", message, problemType?, detail? }` — so a client-side required-field error and a server validation error are distinguishable, and a future annotation/extraction seam has a defined `source` to write under.
- **`useEntityFormState()`** (`state/use-entity-form-state.ts`) replaces `useFormFields`: same dismissal-tracking/dirty-check behaviour, ported onto `FieldDescriptor[]`/`FieldError[]` instead of the old types.
- Values/submit are unchanged: `HalFormValues<T>` + `halFormCodecs` + the existing `useCreateEntityItem` mutation hook.

## Where the engine lives — a single implementation, not two

One alternative considered was placing the new engine "app-level first" under `apps/navigator/src/forms/`, deferring extraction to a shared package "until a second track needs it" (citing ADR-010's cutover-first pattern). That trigger was already met at adoption time: `entity-item-create` was already `x-stability: "stable"` in `packages/features` and already consumed identically by **both** `apps/navigator` and `apps/navigator-experimental`.

The actual hard constraint in this ADR is narrower than "must be app-level": it only rules out `packages/navigator-data` (model-enrichment layer) and `packages/ui` (dumb-widget layer) as homes for the rendering-projection logic. `packages/features/<feature>/` is exactly the layer designed for this per `packages/features/CLAUDE.md` — features are the unit of promotion/sharing between tracks, and no code moves between directories on promotion. The relation-fetching exception ("`packages/ui` can't fetch, but the relation case may") works identically whether `FieldRenderer` lives in `apps/navigator/src/forms/` or `packages/features/src/entity-item-create/` — `packages/features` already fetches via `navigator-data` hooks today.

**Decision: the engine lives inside `packages/features/src/entity-item-create/`, replacing that feature's internals in place.** Both apps get the new architecture from the same import, with no code duplication, and the old bridge could be deleted outright rather than kept alive for a "legacy path" (`packages/navigator-data/src/form-fields/*` and `packages/ui/src/patterns/form-renderers/field-renderer.tsx` had no other consumers).

**Tradeoff accepted:** this couples `apps/navigator` and `apps/navigator-experimental` on one implementation — a regression here affects both apps simultaneously, with no app-boundary isolation during rollout. Given both tracks already shared this exact feature and it was already `stable`, this was judged the right call over maintaining a duplicate.

## Why drop JSONForms (unchanged from the original decision)

- **Pinned-exact dependency** (`3.6.0`) means we're stuck on a release line. Upgrade is its own project.
- **Ajv + JSON Schema** runtime is heavy and only partially leveraged.
- **Custom renderers** in JSONForms are awkward to write against modern React: imperative tester functions, ranks, and the `dispatch` model don't compose well with hooks-first code.
- **Styling integration** — JSONForms' MUI bridge is what we migrated _away_ from.
- **HAL-Forms ≠ JSON Schema.** `_templates` is the actual server contract. Round-tripping it through JSON Schema loses information and adds translation layers.
- **`@contentgrid/hal-forms` already exists.** The parsing problem is solved upstream.

## Why custom renderers (vs. another forms library) — unchanged

- **TanStack Form** / **React Hook Form** were both considered and rejected — we need _server-driven_ fields, not user-defined schemas, and adopting either would still require writing every shadcn-native field component ourselves.
- Hand-rolled state (`useEntityFormState`, formerly `useFormFields`) closes the gap more cheaply than introducing another library. Nothing rules out adopting TanStack Form _inside_ a renderer later if a state-management ceiling is hit.

## Export surface stays stable

`packages/features/src/entity-item-create`'s public barrel keeps exporting `CreateEntityItemView` / `CreateEntityItemForm` (same names, prop-compatible) — `CreateEntityItemForm` is now an alias for the new `CreateEntityItemContainer` (the smart component owning gating, relation-profile loading, the mutation, and error mapping), which renders the new chrome-only `CreateEntityItemForm` (in `create-entity-item-form.tsx`) internally. Both apps' route files need zero or near-zero changes.

## Scope of this restructure

This restructure covers the create-form path only: attributes (`text`, `number`, `boolean`, `datetime`, `enum`, `file` placeholder) and relations (`relation`, both cardinalities). It does **not** cover:

- Search-form reuse — `filter` and `sort` are deliberately NOT `FieldDescriptor` union members. Filtering already has a real, differently-shaped home (`packages/features/src/search/filter-properties.ts`'s `SearchFilterProperty`); sort is never a per-field concept in legacy Navigator, but a single collection-view control reading the search template's `_sort` property directly. See `model/field-descriptor.ts`'s doc comment for the full rationale.
- The AI-extraction service itself — the `FieldError` two-source taxonomy leaves a defined `source` for a future extraction-originated error to write under, and `CreateEntityItemContainer` takes an `annotations` prop (keyed by field name, holding a `FieldAnnotation` — an interface, deliberately expandable rather than a fixed value type) so a future extraction feature can offer an externally-extracted value back into a field. Unused and empty for now, in this create-form/attributes-only restructure. Legacy Navigator's own AI-extraction integration (`ExtractionContext.tsx`) is a fuller context-driven citation/popover system; this prop is a narrower seam for the same idea, not a port of that system.
- `file` field rendering — still an inert placeholder, to be addressed separately.

## What is lost by dropping JSONForms — honest inventory (unchanged)

1. **Built-in conditional rules** (`rule.effect: HIDE | SHOW | DISABLE | ENABLE`) — no HAL-Forms equivalent exists today; would need a hand-rolled predicate layer if a production `_templates` ever needs one.
2. **Layout primitives** (tabs, fieldsets, nested layouts) — `LayoutInformation` today only ever produces a single flat group for a create-form; multi-group layout is a placeholder for a future search-form migration, not implemented.
3. **`oneOf`/`anyOf` polymorphic forms** — no HAL-Forms equivalent; would need per-case implementation if it arises.
4. **Ajv validation cohesion** — replaced by `useEntityFormState`'s client-side required-field validation plus `FieldError`'s external/server half; different idiom, not a drop-in replacement for arbitrary Ajv keywords.
5. **An external ecosystem** — the renderer set is bespoke; every problem is our problem.

## Surviving open risk (unchanged)

If a customer's HAL-Forms `_templates` evolves and introduces a shape `FieldDescriptor`'s discriminated union doesn't cover, the failure mode is a TypeScript compile error (visible), not a silent fallback. `FieldRenderer` renders an explicit "not yet supported" placeholder for any `kind` without a producer or widget, so a gap surfaces as a visible placeholder in the UI, not a crash or a silently dropped field.

## Consequences

**Positive:**

- Forms are still driven by the actual server contract (`_templates`), not by profile metadata.
- `FieldDescriptor` is a TypeScript discriminated union — exhaustiveness checked by the compiler.
- Model enrichment and rendering projection are now independently evolvable: a new widget or error-display change never touches `packages/navigator-data`, and a new attribute constraint never touches `packages/ui`.
- The one "packages/ui can't fetch" exception (`relation` fields) is now structurally explicit — it lives in `packages/features`, not smuggled into `packages/ui` or worked around with prop-drilled fetch results.
- Both `apps/navigator` and `apps/navigator-experimental` share one implementation with zero duplication.

**Negative / accepted:**

- We own the renderer set forever. Mitigated by keeping the surface narrow and tested.
- Both apps move together — a regression in the shared engine affects both tracks simultaneously, with no per-app staged rollout (see "Where the engine lives" above).
- `FieldDescriptor.property` carrying the raw `HalFormsProperty` through is a wider surface than the old `RenderFieldDescriptor`'s hand-picked fields — a renderer can now reach into template internals directly, which needs review discipline to keep `packages/ui` genuinely descriptor-agnostic (it never receives `property` — only the plain scalars `FieldRenderer` extracts from it).

## Reconsider when

- HAL-Forms grows shapes the `FieldDescriptor` union can't render with a small custom set (e.g. recursive nested objects, deeply conditional fields). Then evaluate TanStack Form _or_ a focused new renderer.
- A search-form migration is undertaken — revisit whether `LayoutInformation`'s single-group assumption still holds, and whether `filter`/`sort` warrant their own `FieldDescriptor`-shaped types at that point (see `model/field-descriptor.ts`'s doc comment for why they don't today).
- A customer requires a forms-builder UX (end-users defining their own forms). That's a different problem domain.

---

**Hub:** [[README|ADR Index]]
