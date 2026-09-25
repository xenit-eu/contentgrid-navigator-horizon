# Implementation Plan: Generic HAL-Forms Field Renderer

**Branch**: `001-hal-form-layout` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

> **Amendment (2026-09-18, during implementation)**: the "standalone, no migration" scope below
> (and FR-022) was the plan as clarified — it changed mid-implementation. The user explicitly
> directed migrating the real search-form UI (`entity-item-collection-view.tsx`) onto this
> renderer now, deprecating `FilterSidebar` for that call site. Since `entity-item-collection`
> is `stable` and this feature started `experimental`, Constitution Principle IV blocked that
> import outright; resolved by promoting `hal-forms` to `stable` (dependency graph checked clean
> — no feature-level dependencies) rather than adding a documented exception. See the
> Constitution Check's own note below and `research.md`'s updated decision.
>
> **Second amendment (2026-09-18, same day)**: the user then directed also migrating the
> create-form path (`create-entity-item-container.tsx`/`create-entity-item-form.tsx`) onto this
> renderer, retiring `resolveCreateFieldDescriptors`/`FormContainer`/`FieldRenderer`/
> `useEntityItemCreateFormState` for that call site (Phase 10 in `tasks.md`). No stability-gate
> conflict this time — `hal-forms` was already `stable` from the first amendment. Both form paths
> now render through this feature; nothing in `entity-item-create`/`search` remains un-migrated.

**Input**: Feature specification from `/specs/001-hal-form-layout/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Introduce one new, standalone feature (`packages/features/src/hal-forms/`) that renders any
HAL-FORMS template — create or search — through a single field model, row-based layout schema,
and shared cross-cutting behavior (client+server validation, external value fill, an extensible
provenance indicator with a popover, and a new autocomplete field kind). It generalizes the
create-form path's existing `FieldDescriptor`/`LayoutInformation`/`FormContainer` shapes
(`packages/features/src/entity-item-create/`) rather than reinventing them, and derives the
search-form default layout (pairing `~before`/`~after` range variants) from the existing
`groupKey`/`directionLabel` grouping already computed in `packages/features/src/search/filter-properties.ts`.
Per FR-022/FR-023, this feature is delivered standalone — it does not migrate the existing
`entity-item-create` or `search` mechanisms onto it, but must not omit any capability either one
currently has.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19 (matches the rest of the monorepo — no new
language/runtime introduced).

**Primary Dependencies**: `@contentgrid/navigator-data` (re-exported `CreateHalFormTemplate`,
`SearchHalFormTemplate`, `HalFormsProperty`, `useTypeahead`, `createValues`/`HalFormValues`),
`@contentgrid/ui` (existing renderers `TextRenderer`/`NumberRenderer`/`BooleanRenderer`/
`DateTimeRenderer`/`EnumRenderer`/`EnumMultiRenderer`, `Popover` primitive, plus the new
`AutocompleteRenderer` pattern this plan adds), TanStack Query (via `navigator-data` hooks only —
never called directly from this feature's render layer, per the two-layer model).

**Storage**: N/A. This feature receives a `LayoutSchema` as an input and never persists one itself
(FR-022; persistence is the later, separate admin-editor effort noted in the spec's Assumptions).

**Testing**: Vitest + React Testing Library (existing monorepo convention); MSW-backed contract
fixtures only if a new/changed `navigator-data` hook is introduced (none are — `useTypeahead`
is reused as-is).

**Target Platform**: Web (React SPA), same three-track delivery model as the rest of Navigator.

**Project Type**: Frontend feature module inside an existing pnpm monorepo (no new project/repo).

**Performance Goals**: No new targets beyond what's already established — typeahead suggestions
already debounce at 250ms (`useDebouncedValue`, reused unchanged); no requirement in this spec
implies a stricter target.

**Constraints**: Constitution Principles II (model-first, no hardcoded attribute names), III
(two-layer dependency — `packages/ui` stays descriptor-agnostic; this feature never imports a
Layer-1 `@contentgrid/*` package directly), and IV (a new feature starts at `x-stability:
"experimental"`; `apps/navigator` may not import it) all apply directly. See Constitution Check
below for the one flagged deviation from a documented (not constitutional) prior decision.

**Scale/Scope**: One new feature module, ~7 field kinds (6 existing + `autocomplete`) × 2 form
types (create, search) × arbitrary customer-defined entities/attributes. No new persistence
surface, no new backend endpoint.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                                | Check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Result                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| I. HAL Is the Only Interaction Model                     | This feature reads existing `CreateHalFormTemplate`/`SearchHalFormTemplate` accessors only; it introduces no new mutation, URL construction, or template parsing of its own.                                                                                                                                                                                                                                                                                                                                                                         | **Pass**                  |
| II. Model-First — No Hardcoded Domain Knowledge          | `resolveHalFormsFields` discovers fields from the template at runtime, same as today's `resolveCreateFieldDescriptors`; no entity/attribute name is hardcoded.                                                                                                                                                                                                                                                                                                                                                                                       | **Pass**                  |
| III. Two-Layer Dependency Model & Package Boundaries     | New `packages/ui` pattern (`AutocompleteRenderer`) takes only plain scalar props, no `@contentgrid/navigator-data` import, matching `filter-sidebar.tsx`'s existing external-suggestions boundary. New feature code imports `navigator-data`/`ui` only, never a Layer-1 package directly.                                                                                                                                                                                                                                                            | **Pass**                  |
| IV. Three-Track Delivery & Stability Gating              | New feature directory started at `"x-stability": "experimental"`; promoted to `"stable"` (2026-09-18) once the real search-form migration required `entity-item-collection` — itself `stable` — to import it (Principle IV forbids the reverse). Dependency graph checked clean before promotion (no feature-level dependencies; only `navigator-data`/`ui`, neither stability-tagged). `entity-item-create` (also `stable`) now imports it too, per the second amendment above — no further gating conflict since `hal-forms` was already `stable`. | **Pass**                  |
| V. Deny-by-Default ABAC                                  | No new mutation or capability check introduced — field-level ABAC (template/property presence) is unchanged; this feature only changes how already-permitted fields are laid out and decorated.                                                                                                                                                                                                                                                                                                                                                      | **Pass** (no new surface) |
| VIII. View-Owned Data Loading & Transformation Placement | `resolveHalFormsFields`/`generateSearchFormLayout` are pure, no data-fetching — matches the "transformation lives in a util/model layer, not inline in a view" rule. `useTypeahead` stays the sole data-fetching call, made at the feature layer, not inside `packages/ui`.                                                                                                                                                                                                                                                                          | **Pass**                  |

**Flagged (not a constitution violation — a documented prior decision this plan knowingly
supersedes)**: `entity-item-create/model/field-descriptor.ts`'s doc comment states filtering
"already has a real, working, differently-shaped home" and that "there is no future migration"
routing it through that type. This plan does not touch that file or route search through it — it
adds a **separate**, new model instead — but its entire premise (one generic renderer behind both
forms) is the reversal that comment argued against. See `research.md`'s "superseding" decision
for the full justification; recorded here per Governance's requirement that a deviation from
documented guidance be explicit, not silent. Tracked in Complexity Tracking below.

## Project Structure

### Documentation (this feature)

```text
specs/001-hal-form-layout/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   └── hal-forms-public-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks command — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/features/src/hal-forms/            # NEW feature, x-stability: "stable" (promoted 2026-09-18)
├── package.json                            # { "x-stability": "stable" }
├── index.ts                                # public barrel (see contracts/hal-forms-public-api.md)
├── model/
│   ├── hal-forms-field.ts                  # HalFormsField union (data-model.md) — incl. SearchAutocompleteContext
│   ├── layout-schema.ts                    # LayoutSchema/FieldSection/FieldRow (FieldSection adds
│   │                                        # title/description/isCollapsible, 2026-09-18 amendment)
│   ├── resolve-hal-forms-fields.ts         # pure bridge: template (+ savedLayout?, autocompleteFieldNames?) -> { fields, layout }
│   ├── generate-search-form-layout.ts      # pure: (SearchHalFormTemplate, fields) -> LayoutSchema (before/after pairing)
│   └── *.test.ts
├── render/
│   ├── hal-forms-container.tsx             # renders layout.sections[].rows (ports FormContainer's row logic);
│   │                                        # a collapsible section wraps its rows in one Accordion item
│   ├── hal-forms-field-renderer.tsx        # kind switch (ports field-renderer.tsx + autocomplete + provenance/popover);
│   │                                       # fetches nothing itself — autocomplete suggestions come from fieldState.autocomplete
│   └── *.test.tsx
├── state/
│   ├── use-hal-forms-field-state.ts        # value/touched/error state; client+server validation (FR-008-010)
│   ├── field-provenance.ts                 # setExternalValue guard (FR-011/012)
│   └── *.test.ts
└── validation/
    ├── validate-field.ts                   # client-side validation entry point (current data / validation fn)
    └── *.test.ts

packages/ui/src/patterns/
├── autocomplete-renderer.tsx               # NEW pattern (descriptor-agnostic; contracts/hal-forms-public-api.md)
├── autocomplete-renderer.stories.tsx
└── autocomplete-renderer.test.tsx

packages/features/src/entity-item-collection/entity-item-collection-view.tsx  # MIGRATED (2026-09-18):
  # renders HalFormsContainer instead of FilterSidebar for the search-filter dialog. Still owns
  # useTypeahead itself and feeds results into fieldState[name].autocomplete — the render layer
  # above never fetches. filter-properties.ts (../search/) stays the string<->typed encoding
  # source of truth (coerceFilterValue, findInvalidFilterKeys, etc.); only rendering moved.
  # FilterSidebar/TypeaheadTextFilter (packages/ui) are now unused by this call site but not
  # deleted.

packages/features/src/entity-item-create/create-entity-item-container.tsx     # MIGRATED (2026-09-18):
packages/features/src/entity-item-create/create-entity-item-form.tsx          #   renders
  # HalFormsContainer instead of FormContainer; resolveHalFormsFields instead of
  # resolveCreateFieldDescriptors; useHalFormsFieldState instead of useEntityItemCreateFormState;
  # toServerFieldErrors (new, exported from hal-forms) instead of ./state/to-field-errors.ts's
  # toFieldErrors. resolveCreateFieldDescriptors/FormContainer/FieldRenderer/
  # useEntityItemCreateFormState/FieldDescriptor/LayoutInformation are now unused by these two
  # files but not deleted (same precedent as FilterSidebar above).

apps/navigator-experimental/
└── src/routes/hal-forms-demo.tsx           # DEV-gated manual-QA fixture (kept, not temporary)
```

**Structure Decision**: a new, additive feature directory alongside (not inside) the existing
`entity-item-create`/`search` features, per `packages/features/CLAUDE.md`'s "each feature is a
subdirectory" model. Originally scoped to avoid touching either existing `stable` feature
(FR-022's standalone premise); amended mid-implementation once the user directed migrating the
real search UI onto it — see the plan header's amendment note. The one new `packages/ui` pattern
follows that package's existing primitive/pattern split exactly (`src/patterns/<kebab-case-name>.tsx`

- story, per `packages/ui/CLAUDE.md`'s "write a new pattern locally" recipe).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                                                                                                                                                                                                                                         | Why Needed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Simpler Alternative Rejected Because                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Introducing a second, parallel field-rendering model (`HalFormsField`/`LayoutSchema`) alongside the existing, `stable` `entity-item-create` one, despite that feature's own doc comment arguing against ever unifying create and search this way. | The spec's own clarification (Q1) explicitly scoped this feature to standalone delivery — migrating `entity-item-create`/`search` onto a shared model in the same pass was ruled out as too large a change to land alongside validation/provenance/autocomplete, which aren't proven yet. Building the new model first, then migrating once it's proven (FR-023's parity requirement exists precisely to make that migration viable later), is the incremental path Constitution Principle IV's stability gating is designed for. | Modifying `entity-item-create`/`search` (both `stable`) in place was rejected: it would mix unproven new behavior into code the generic (`apps/navigator`) production track already depends on, and Principle IV forbids a `stable` feature depending on an `experimental` one — so an in-place change couldn't even stay `experimental` without breaking that boundary from the other side. |

**Amendment (2026-09-18)**: the standalone premise above held only until the user explicitly
directed migrating the real search UI. At that point `hal-forms` was promoted to `stable`
(dependency graph checked clean first) rather than adding a second entry here — promotion, not
a documented constitutional exception, is what actually resolved the conflict; see the plan
header's amendment note and `research.md`.
