# packages/features — CLAUDE.md

Package: `@contentgrid/features` (private — not published to npm)
Purpose: Feature modules for the Navigator. Features are the unit of functionality shared between
tracks; the stability flag that gates which app tracks can import something lives on the views above
them (`packages/views`).

Platform-wide conventions: see root [`CLAUDE.md`](../../CLAUDE.md).
Three-track model: [ADR-006](../../docs/adr/ADR-006-three-track-delivery-model.md).
Views layer above features (navigation context, layer rules): [ADR-018](../../docs/adr/ADR-018-views-layer.md), [`packages/views/CLAUDE.md`](../views/CLAUDE.md).

---

## Directory layout

```
packages/features/
  src/
    <feature-name>/       # one directory per feature
      package.json        # optional; carries NO "x-stability" (stability lives on views)
      index.ts            # public API of the feature
      ...
  index.ts                # barrel (re-exports stable features; subject to track rules)
```

Each feature is a subdirectory under `src/`. Features are NOT separate workspace
packages — they share the `@contentgrid/features` package and are distinguished
by subdirectory path.

---

## Stability lives on views

([ADR-018](../../docs/adr/ADR-018-views-layer.md), [ADR-006](../../docs/adr/ADR-006-three-track-delivery-model.md),
spec 005 FR-028 / FR-035)

Feature directories carry **no** `x-stability` field. The tag moved to the views in
`packages/views/src/*` (each view's `package.json`; see [`packages/views/CLAUDE.md`](../views/CLAUDE.md#stability)),
and `@contentgrid/no-unstable-views` resolves it for `@contentgrid/views/<view>` imports. A feature
is as stable as the views that use it; a stable view that needs an experimental feature gets an
experimental copy of the view (provisional pending spec open question 1).

- Do NOT add an `x-stability` field to a feature's `package.json`; the lint rule ignores it there.
  A feature directory needs a `package.json` only for something else (e.g. a name or description).
- Apps import features only through views (layer rule L1,
  [`layer-lint-rules.md`](../../specs/005-views-layer/contracts/layer-lint-rules.md)). The few features no
  view wraps yet are listed in `PENDING_VIEW_FEATURES` in each app's `eslint.config.js` (both identical; empty at go-live);
  those imports are not stability-checked, since a feature has no tag.
- Features never import `@contentgrid/views` (L4) or the router (L2; the exemption is listed in the
  `ROUTER_EXEMPT` constant of `packages/features/eslint.config.js`).
- **Pre-GA:** the generic app's gate stays suspended — see the
  [ADR-006 amendment](../../docs/adr/ADR-006-three-track-delivery-model.md#amendment-2026-09-23-stability-gate-suspended-pre-ga).
- The CI bundle audit that would fail the generic build if `experimental` or `candidate` code appears
  in its bundle is not yet wired.

---

## Page layout

Page frames (`PageLayout`, `BreadCrumbsToolBarLayout`, `SideBarLayout`) and the app shells (router, auth, profile gate,
sidebar) live in `@contentgrid/views`, not here. Only `RightSidePanelLayout` and `EntityIconBadge` remain in
`src/layout/`, because features use them. Features do not import `@tanstack/react-router` — the one exception is
`unsaved-changes-guard` (its home is open question 3 of the views spec) and the edit-form tests that exercise it.

([ADR-018](../../docs/adr/ADR-018-views-layer.md), `specs/005-views-layer/contracts/view-toolbar.md`)

- A feature draws no toolbar, breadcrumbs or page actions, and takes no props for them. The view
  above it draws them (`@contentgrid/views`).
- A feature fills the space it is given: root `h-full min-h-0`, no outer page padding, and no
  window-sized units (`vh`, `svh`) or fixed widths. The view (or host) owns padding and scrolling.
- A feature receives the main object it shows (`ProfileEntity`, `EntityItem`) from its view and
  never loads it again; it loads follow-up data (relations, content) itself by following links.
- A feature never reads navigation: user actions leave through callback props.

---

## Promotion workflow

Promotion now flips `x-stability` in the **view's** `package.json`, not in a feature directory — see
[`packages/views/CLAUDE.md`](../views/CLAUDE.md#stability) and
[`apps/navigator-experimental/CLAUDE.md`](../../apps/navigator-experimental/CLAUDE.md). Pre-GA the
workflow is suspended (the generic app imports views at any tier).

---

## What belongs in a feature vs. in packages/ui or packages/navigator-data

- If a component is only used in ONE feature → it lives inside
  `packages/features/<feature>/`, not in `packages/ui`.
- If a component is reused across multiple features or tracks → it belongs in
  `packages/ui/src/patterns/`.
- If logic touches HAL, ETags, or TanStack Query hooks → it belongs in
  `packages/navigator-data`, not in the feature.
- **Every HAL-Forms-driven form renders through the `hal-forms` feature**
  (`src/hal-forms/`, ADR-004 amended 2026-10-01) — the create form and the search/filter
  form today, and any new form (e.g. an update form). Resolve fields with
  `resolveHalFormsFields`, render them with `HalFormsContainer`, and keep their state in
  `useHalFormsFieldState`. The feature that owns the form keeps only its chrome (submit,
  cancel, alerts, the request it sends). Do NOT add a feature-local field type, `kind`
  switch or field-state hook; to support a new property shape, add a `kind` to
  `HalFormsField`, map it in `resolveHalFormsFields` and render it in
  `HalFormsFieldRenderer`.

---

## `entity-search-bar` feature (`src/entity-search-bar/`)

The single search bar on the entity item collection page (spec
`specs/003-single-search-bar-entity-item-collection/`): active-filter chips, a
search-parameter selector with a suggestions popover, and quick filters.
(its importer, `entity-item-collection`, is stable).

- **Controlled by the collection's `filters`** (the `s.<param>` URL state) through
  `onFiltersChange` — it shares that state with the advanced filter dialog; it keeps no filter
  state of its own and adds no URL keys.
- **`util/` vs `components/`**: every model (search-parameter descriptors, selector groups,
  suggestion chips/groups, active-filter chips, quick filters, date presets) is built by a pure
  function in `util/` with a sibling test; `use-entity-search-bar.ts` only orchestrates;
  components render finished models and pick icons (`components/search-icons.tsx`).
- **Fields come from `resolveHalFormsFields`**, so the bar offers exactly the dialog's
  parameters. The number quick filter renders through `HalFormsContainer` +
  `useHalFormsFieldState`. `valueKindOf` in `util/build-search-param-descriptors.ts` holds the one
  switch on a field's `kind`, mapping it to the feature's own `valueKind`;
  `util/build-quick-filters.ts` then picks a quick-filter type from that `valueKind`. This is a
  documented deviation from the "no feature-local `kind` switch" rule above (see the spec's
  `plan.md`, Complexity Tracking); do not add a second switch on `field.kind`.
- **Editing an applied filter**: clicking a chip loads a single selectable parameter into the main
  bar (selected, value in the focused input; Enter replaces the filter) or opens the quick filter
  covering all its parameters. The quick-filter popovers are controlled by the hook
  (`openQuickFilter`) so a chip can open them.
- **Inclusion**: `searchAttributes` in `EntityDisplayPreferences` (edited next to "Visible
  columns") limits the selector, suggestions and quick filters; chips always show every active
  filter, and relation parameters are always included. Import `useSearchAttributeInclusion` by
  file path (`../preferences/use-search-attribute-inclusion`), not through `../preferences` —
  the preferences previews import the collection view, which imports this feature.

---

## peerDep policy

Features consume `packages/ui` and `packages/navigator-data` via the workspace
protocol. React and react-dom are inherited as peerDeps. Do not declare
`@contentgrid/hal` or other Layer-1 packages as direct deps in a feature — go
through `@contentgrid/navigator-data` instead.

---

## Forbidden imports

- Do NOT import from `apps/*`.
- Do NOT import `@contentgrid/hal`, `@contentgrid/hal-forms`, or other
  `@contentgrid/*` Layer-1 packages directly. Use the hooks and types exported
  from `@contentgrid/navigator-data`.
- Do NOT import `@contentgrid/views` (L4) or the router (L2) — both are lint errors
  (`packages/eslint-config`, [`layer-lint-rules.md`](../../specs/005-views-layer/contracts/layer-lint-rules.md)).
  Features carry no stability tag, so there is no feature-to-feature stability rule; stability is
  checked between views.
