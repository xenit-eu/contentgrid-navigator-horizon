# Research: Create Item Page and Upload into Empty Content Attributes

**Feature**: [spec.md](spec.md) | **Date**: 2026-09-30

Input to `/speckit-plan`. Records how the original Navigator ([`xenit-eu/contentgrid-navigator`](https://github.com/xenit-eu/contentgrid-navigator)) implements the flow, what the new Navigator already has, and the decisions taken.

## 1. Original Navigator

| Concern                     | Implementation                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route                       | `~create` → `pages/ClassifyCreateInstancePage.tsx`; sidebar links to it via `getClassifyCreateInstanceUrlPath()` (`components/sidebar/Sidebar.tsx`).                                                                                                                                                                                      |
| Card                        | `ClassifyCreateEntityInstance` inside `CardWithLogo` — title "Create Item", subtitle "Select the entity you want to create."                                                                                                                                                                                                              |
| Entity list                 | `profiles.filter(profile => profile.createTemplate)` — gated on the create template.                                                                                                                                                                                                                                                      |
| Selector                    | `components/profile/ProfileSelector.tsx`: MUI `Select`, title per option, description only as an optional tooltip.                                                                                                                                                                                                                        |
| Navigation                  | Selecting an entity navigates immediately to `getCreateUrlPath(profile)`; there is no Continue button.                                                                                                                                                                                                                                    |
| File hand-off               | `CreateEntityInstanceContext` (React context) holds `initialFile`. The create page reads it and passes it to `CreateEntityInstance`.                                                                                                                                                                                                      |
| Prefill                     | `firstContentProperty = createTemplate.properties.find(p => p.type === "file")`; initial values are `values.withValue(firstContentProperty.name, initialFile)`.                                                                                                                                                                           |
| Clearing                    | The file is cleared when the user removes it in the form (`setInitialFile(null)`). `CreateInstancePage.handleOnCreate` also clears it after every successful create (including continuous mode). It is **not** cleared on navigation or cancel, so it follows the user across entity switches. This feature keeps that lifetime (FR-008). |
| Entity switch on create     | `CreateInstancePage` toolbar renders `ProfileSelector` (current entity selected, `showTooltips={false}`); selecting navigates to that entity's create route; `CreateEntityInstance` is keyed on `profile.name` so the form resets.                                                                                                        |
| No file field               | Nothing shown; the file simply is not used by that form and stays in context.                                                                                                                                                                                                                                                             |
| Upload into empty attribute | Content upload from the item page (`FileUpload` component), PUT to the `cg:content` link.                                                                                                                                                                                                                                                 |

## 2. New Navigator — what exists

| Piece                   | Location                                                                                                          | State                                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entity selector         | `packages/ui/src/patterns/entity-selector/entity-selector.tsx` (`ProfileEntitySelector`)                          | Radix `Select`; option `{ name, title }`; returns `null` when fewer than two entities; label inline; **no consumers**. Has stories and tests.                                                                |
| Attribute selector      | `packages/ui/src/patterns/attribute-selector/attribute-selector.tsx`                                              | Reference style: compact trigger label (icon + title), rich rows (icon, title, description), `Label` above, grouped options.                                                                                 |
| Entity icon             | `packages/features/src/layout/components/entity-icon-badge.tsx` (`EntityIconBadge`)                               | Icon + colour from `useEntityDisplayPreferences(profile)`; defaults from `ProfileEntity.getDefaultPreferences()`.                                                                                            |
| Entities                | `useLoadedProfileEntities()` (`navigator-data`)                                                                   | Returns loaded `ProfileEntity[]` + `isLoading`; used by the sidebar.                                                                                                                                         |
| Create template gate    | `ProfileEntity.createTemplate`                                                                                    | `null` when not permitted.                                                                                                                                                                                   |
| Per-entity create route | `apps/navigator/src/routes/_app/$entity/~create.tsx` → `CreateEntityItemView`                                     | Exists in both apps.                                                                                                                                                                                         |
| Create form state       | `hal-forms/state/use-hal-forms-field-state.ts` `useHalFormsFieldState({ fields, initialValues, externalErrors })` | Already accepts `initialValues`. Shared with `HalFormsContainer` and the collection filter dialog. `reset()` restores the seeded values. `CreateEntityItemContainerReady` does not pass `initialValues` yet. |
| Fields                  | `resolveHalFormsFields(createTemplate)` → `kind: "file"` fields                                                   | Order = create-template order.                                                                                                                                                                               |
| Create-form file field  | `hal-forms/render/hal-forms-field-renderer.tsx` `case "file"`                                                     | Renders `FileRenderer` (`FileUploadZone`).                                                                                                                                                                   |
| File drop zone          | `packages/ui/src/patterns/file-upload-zone` (`FileUploadZone { file, onFileChange, accept? }`)                    | Single file; takes the first dropped file.                                                                                                                                                                   |
| Sidebar button          | `packages/features/src/layout/sidebar-layout.tsx` `SidebarCreateItemButton`                                       | Label "Create Item"; navigates to `/`.                                                                                                                                                                       |
| Empty content state     | `content-focus/components/content-preview-frame.tsx` `state === "noFile"`                                         | Renders `FileUploadZone` with a no-op handler when `onFileChange` is absent. `ContentPreviewPanel` never passes it.                                                                                          |
| Upload hook             | `navigator-data/src/hooks/item/use-content.ts` `useUploadContent(entityItem, attributeName)`                      | PUT via `contentFetch`, `If-Match` from ETag, 412 surfaces as `ProblemDetailError`, re-fetches item and updates cache. Does not touch the cache on error. No consumer yet.                                   |
| Upload gate             | `EntityItem.canUploadContent(attributeName)`                                                                      | `cg:content` link presence.                                                                                                                                                                                  |

## 3. Decisions

### D1 — Extend `ProfileEntitySelector` rather than create a new selector

- **Decision**: Extend the existing pattern option gains `description?` and `icon?: ReactNode`; rows adopt the attribute selector's layout; label moves above the field.
- **Rationale**: One entity selector in the design system; no consumers today, so no migration cost.
- **Alternatives rejected**: A new `EntityPicker` pattern (duplicate); a features-level component (not reusable outside features).

### D2 — Remove the "hide below two entities" rule

- **Decision**: The pattern always renders; callers decide whether to render it.
- **Rationale**: The Create item page needs it for a single entity (US1-7). No consumer relies on the rule.
- **Alternative rejected**: A `hideWhenSingle` prop — extra API for a rule no caller needs.

### D3 — Icons are passed in, not resolved by the pattern

- **Decision**: `ClassifyCreateEntityItemView` (features) maps each `ProfileEntity` to an option and renders the icon with `EntityIconBadge`.
- **Rationale**: `packages/ui` may not import `navigator-data` or `features` (`packages/ui/CLAUDE.md`).

### D4 — Continue button

- **Decision**: Choosing an entity selects it; **Continue** opens its create form.
- **Consequence**: The file can be attached before or after choosing the entity.
- **Alternative rejected**: Navigating on selection — the user could no longer attach the file after choosing the entity.

### D5 — File hand-off through a Zustand store

- **Decision**: Module-level Zustand store in `entity-item-create/state` holding `initialFile: File | null`, with `useCreateEntityItemState((s) => s.initialFile)` (selector hook), `setInitialFile(file | null)` and `useCreateEntityItemState.getState().initialFile` (non-reactive read). Lifetime: cleared after a successful create or when the user removes the file; kept across entity choices, cancels and switches.
- **Rationale**: ADR-001 puts client state in Zustand. It needs no provider in the app shell, and only the two components that use the file subscribe to it, so nothing else re-renders when it changes. Router history state was rejected because it survives reload and back/forward, so a removed file could reappear.
- **Alternatives rejected**: search param and `sessionStorage` (FR-008 forbids; `File` is not serialisable), React context (app-shell wiring for one value), router history state (see above).

### D6 — Prefill through `initialValues`

- **Decision**: `CreateEntityItemContainerReady` reads `useCreateEntityItemState.getState().initialFile` once (lazy `useState` initialiser), finds the first `kind === "file"` field from `resolveHalFormsFields` and passes `{ [name]: file }` as `initialValues`. No file field → nothing is shown. After a successful create the container calls `setInitialFile(null)` and `formState.reset({})`. `useHalFormsFieldState.reset(newBaseline?)` takes an optional new baseline: when given, it replaces `initialValuesRef` before resetting, so a continuous-create reset starts empty (instead of restoring the prefilled file) and `isDirty` compares against the empty baseline. `reset()` without arguments behaves as before (the filter dialog and `HalFormsContainer` rely on it). When the user clears that file field, the container's wrapped `setValue` clears the store (see `contracts/classify-create-entity-item-view.md`).
- **Rationale**: Reuses the existing form-state API, so the file is present on the first render without a ref flag or a separate reset path.

### D7 — Entity switch in the create form toolbar

- **Decision**: The `$entity/~create` route passes a toolbar `ProfileEntitySelector` (via `BreadCrumbsToolBarLayout`'s `actions` slot, rendered by a features component `CreateEntityItemProfileSelector`) listing the same creatable entities; selecting navigates to that entity's create route. `CreateEntityItemView` is keyed on `profile.name` so the form state resets on switch (TanStack Router keeps the component mounted when only params change). The existing `useUnsavedChangesGuard` already blocks navigation with unsaved changes (FR-021).
- **Rationale**: Lets the user change the entity without going back to the Create Item page, and gives the reusable selector a second consumer.

### D8 — Empty-attribute upload wiring in `ContentPreviewPanel`

- **Decision**: The panel owns `useUploadContent(entityItem, attributeName)` and passes `onFileChange` to the frame only when `entityItem.canUploadContent(attributeName)`. The frame gets a new `uploading` state. Errors map to the existing problem display (`toProblemDisplayModel`). On 412 `useUploadContent` invalidates the item query (D10), so the next drop uses the new ETag. On success the hook updates the item cache; the viewer's key already includes the ETag, so it remounts on the new file.
- **Rationale**: The panel already owns the preview and download hooks for that attribute (view-owned data loading, constitution VIII).
- **Alternative rejected**: Upload in the frame (presentational component would fetch).

### D9 — Frame without a handler renders no drop zone

- **Decision**: Remove `NOOP_FILE_CHANGE`; with no `onFileChange` the `noFile` state shows only its caption.
- **Rationale**: FR-014 — showing an inert drop zone to a user without upload rights is misleading.

### D10 — `useUploadContent` invalidates the item on 412

- **Decision**: `useUploadContent` (`navigator-data/src/hooks/item/use-content.ts`) gets an `onError` that invalidates `queryKeys.entityItem.byUrl(profileEntity, entityItem.selfLink.href)` when the error is a 412 (`unsatisfied-version`), then calls the caller's `onError`. No auto-retry. Covered in `use-content.test.tsx`.
- **Rationale**: Without it the cached item keeps its old ETag, so every retry sends the same stale `If-Match` and fails with 412 again until a manual reload (against FR-016/FR-018). In the hook, every upload caller (this panel, the `003` edit form) gets it without having to remember it.
- **Alternative rejected**: `ContentPreviewPanel` passing `mutationOptions.onError` — local, but each caller would have to repeat it.

### D11 — Shared `useCreatableProfileEntities()` hook in `navigator-data`

- **Decision**: New hook `useCreatableProfileEntities()` in `navigator-data/src/hooks/profile/use-profile-entity.ts`: wraps `useLoadedProfileEntities()` and returns the `ProfileEntity`s with `createTemplate !== null`, in profile-root order, plus `isLoading`.
- **Rationale**: The Create Item page, the create-form toolbar selector and the `~create` route all need the same list; one hook keeps the `createTemplate` gate (deny-by-default) in one place instead of three inline filters.
- **Alternative rejected**: Filtering inline in each consumer — three copies of the gate that can drift.

## 4. Open points

- Mockup file-type/size hint — not shown (no model source).
