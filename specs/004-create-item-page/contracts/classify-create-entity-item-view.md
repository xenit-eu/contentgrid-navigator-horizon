# Contract: Create item page

**Requirements**: FR-001 – FR-010, FR-020, FR-021

## `ClassifyCreateEntityItemView` (`@contentgrid/features/entity-item-create`)

**File**: `packages/features/src/entity-item-create/classify-create-entity-item-view.tsx`

```ts
export interface ClassifyCreateEntityItemViewProps {
  /** Called as soon as an entity is chosen, after the pending file (if any) was stored. */
  readonly onSelect: (profile: ProfileEntity) => void;
  readonly onCancel: () => void;
}
```

- Loads entities itself with `useLoadedProfileEntities()` (constitution VIII); filters on `profile.createTemplate !== null`, keeping sidebar order.
- Loading → `LoadingPage`-style skeleton inside the card; no creatable entity → message "There is nothing you can create." with Cancel only.
- Card: title "Create Item", subtitle "Select the entity you want to create.", `ProfileEntitySelector` (`label="Entity"`), section label "Upload a file (optional)", `FileUploadZone`, footer Cancel (ghost). No Continue button.
- The drop zone is bound to the store: `initialFile` and `setInitialFile` from `useCreateEntityItemState` — returning to the page shows the file still attached.
- Selecting an entity: `onSelect(profile)` — the route navigates immediately.
- Cancel: `onCancel()` only; never writes the store.
- Uses the `Card` primitive. The application logo is not rendered: the only logo asset is private to the `BrandingHeader` pattern.

## Pending create file store

**File**: `packages/features/src/entity-item-create/state/create-entity-item-state.ts`

```ts
export const useCreateEntityItemState: UseBoundStore<{
  file: File | null;
  setInitialFile: (file: File | null) => void; // null clears
}>;
```

Same idiom as `useEntityDisplayPreferencesStore`: components subscribe with a selector; non-React code (the create container's mount and submit handlers) uses `useCreateEntityItemState.getState()`. Not exported from the package index.

## Create container prefill

**File**: `packages/features/src/entity-item-create/create-entity-item-container.tsx`

- In `CreateEntityItemContainerReady`: `const [initialValues] = useState(() => { const file = useCreateEntityItemState.getState().initialFile; ... })`.
- First `fields.find(f => f.kind === "file")` receives the file; with no file field nothing is shown and the store is untouched (clarified 2026-09-30).
- After a successful create (normal and continuous mode): `setInitialFile(null)`, then `formState.reset({})` so a continuous-create reset starts empty instead of restoring the prefilled file (`reset` takes an optional new baseline).
- When the user clears that file field: `setInitialFile(null)`.
- Pass `initialValues` to `useEntityItemCreateFormState`.

## Routes (apps — routing only)

**Files**: `apps/navigator/src/routes/_app/~create.tsx`, `apps/navigator-experimental/src/routes/_app/~create.tsx`

```tsx
export const Route = createFileRoute("/_app/~create")({ component: CreateItemRoute });
// onSelect → navigate({ to: "/$entity/~create", params: { entity: profile.name }, search: {} })
// onCancel   → history.back() when there is history, else navigate({ to: "/" })
```

Route trees regenerated (`routeTree.gen.ts`). `~create` does not clash with `$entity` because `~` is not a valid profile name prefix (same convention as `~configuration`).

## Create form toolbar entity switch (User Story 4)

**Files**: `packages/features/src/entity-item-create/create-entity-item-profile-selector.tsx` (NEW), `apps/*/src/routes/_app/$entity/~create.tsx`

```ts
export interface CreateEntityItemProfileSelectorProps {
  readonly selectedProfile: ProfileEntity;
  readonly onSelect: (profile: ProfileEntity) => void;
}
```

- Same entity list and option mapping as `ClassifyCreateEntityItemView` (shared `useCreatableProfileEntities()` / `toProfileEntityOption()` in `entity-item-create`; option title = `profile.title`), rendered as a compact `ProfileEntitySelector` with the current entity selected.
- Route: passed to `BreadCrumbsToolBarLayout`'s `actions`; `onSelect` → `navigate({ to: "/$entity/~create", params: { entity: profile.name }, search: {} })`.
- Route renders `<CreateEntityItemView key={profile.name} … />` so the form resets on switch.
- Unsaved changes: handled by the existing `useUnsavedChangesGuard` in `CreateEntityItemView` — no new code.

## Sidebar

**File**: `packages/features/src/layout/sidebar-layout.tsx` — `SidebarCreateItemLink` navigates to `/~create`.

## Tests

- `classify-create-entity-item-view.test.tsx`: lists only entities with a create template; empty state.
- `create-entity-item-container.test.tsx`: pending file fills the first file field; no file field → no value and store untouched; successful create clears the store; clearing the file field clears the store.
- e2e (`apps/navigator/tests/e2e/navigator.spec.ts`): point `goToClassifyCreateInstancePage` at `/~create`; sidebar → attach file → choose entity → create form shown with the file.
