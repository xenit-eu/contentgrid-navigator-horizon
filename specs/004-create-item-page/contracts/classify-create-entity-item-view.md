# Contract: Create item page

**Requirements**: FR-001 – FR-010, FR-020, FR-021

## `ClassifyCreateEntityItemView` (`@contentgrid/features/entity-item-create`)

**File**: `packages/features/src/entity-item-create/classify-create-entity-item-view.tsx`

```ts
export interface ClassifyCreateEntityItemViewProps {
  /** Called on Continue with the chosen entity; the caller opens its create form. */
  readonly onSelect: (profile: ProfileEntity) => void;
  readonly onCancel: () => void;
}
```

- Loads entities with `navigator-data`'s `useCreatableProfileEntities()` (wraps `useLoadedProfileEntities()`, constitution VIII), which returns the `ProfileEntity`s with `profile.createTemplate !== null`, keeping sidebar order. Options for the `ui` pattern are built with `toProfileEntityOption()` only where they are passed to it.
- Loading → `LoadingPage`; no creatable entity → message "There is nothing you can create." with Cancel and a disabled Continue.
- Card: title "Create Item", subtitle "Select the entity you want to create.", `ProfileEntitySelectorList` (`label="Entity"`), section label "Upload a file (optional)", `FileUploadZone`, footer Cancel (ghost) and Continue (disabled until an entity is chosen).
- The drop zone is bound to the store: `initialFile` and `setInitialFile` from `useCreateEntityItemState` — returning to the page shows the file still attached.
- Selecting an entity marks it (check mark); Continue calls `onSelect(profile)` and the route navigates.
- Cancel: `onCancel()` only; never writes the store.
- A centred card (`bg-card` container). The application logo is not rendered.

## Pending create file store

**File**: `packages/features/src/entity-item-create/state/create-entity-item-state.ts`

```ts
export const useCreateEntityItemState: UseBoundStore<{
  initialFile: File | null;
  setInitialFile: (file: File | null) => void; // null clears
}>;
```

Same idiom as `useEntityDisplayPreferencesStore`: components subscribe with a selector; non-React code (the create container's mount and submit handlers) uses `useCreateEntityItemState.getState()`. Not exported from the package index.

## Create container prefill

**File**: `packages/features/src/entity-item-create/create-entity-item-container.tsx`

- In `CreateEntityItemContainerReady`: `const [initialValues] = useState(() => { const file = useCreateEntityItemState.getState().initialFile; ... })`.
- First `fields.find(f => f.kind === "file")` receives the file; with no file field nothing is shown and the store is untouched.
- After a successful create (normal and continuous mode): `setInitialFile(null)`, then `formState.reset({})` so a continuous-create reset starts empty instead of restoring the prefilled file (`reset` takes an optional new baseline).
- When the user clears that file field: the container wraps the form's `setValue` for the first file field; an empty value calls `setInitialFile(null)` before setting it (no effect, so `reset({})` does not trigger it).
- Pass `initialValues` to `useHalFormsFieldState` (`hal-forms/state/use-hal-forms-field-state.ts`).

## `useHalFormsFieldState.reset`

**File**: `packages/features/src/hal-forms/state/use-hal-forms-field-state.ts` (shared with `HalFormsContainer` and the collection filter dialog)

- `reset(initialValues?: FieldValueMap)`. With an argument it first replaces `initialValuesRef`, so `isDirty` compares against the new baseline after the reset.
- Without an argument it behaves as before: back to the values the hook was seeded with.
- Tests: the existing `reset()` test (no argument, restores the seeded values) stays; a new test covers `reset({})` replacing the baseline.

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

- Same entity list and option mapping as `ClassifyCreateEntityItemView` (`useCreatableProfileEntities()` from `navigator-data`, `toProfileEntityOption()` in `entity-item-create`; option title = `profile.title`), rendered as a compact `ProfileEntitySelector` (`size="sm"`, small icon badges) with the current entity selected.
- Route: passed to `BreadCrumbsToolBarLayout`'s `actions`; `onSelect` → `navigate({ to: "/$entity/~create", params: { entity: profile.name }, search: {} })`.
- Route renders `<CreateEntityItemView key={profile.name} … />` so the form resets on switch.
- Unsaved changes: handled by the existing `useUnsavedChangesGuard` in `CreateEntityItemView` — no new code.

## Sidebar

**File**: `packages/features/src/layout/sidebar-layout.tsx` — `SidebarCreateItemButton` navigates to `/~create`.

## Tests

- `classify-create-entity-item-view.test.tsx`: lists only entities with a create template; Continue disabled until an entity is chosen, then opens it; empty state.
- `create-entity-item-container.test.tsx`: pending file fills the first file field; no file field → no value and store untouched; successful create clears the store; clearing the file field clears the store.
- e2e (`apps/navigator/tests/e2e/navigator.spec.ts`): point `goToClassifyCreateInstancePage` at `/~create`; sidebar → choose entity → Continue → create form shown; switch entity from the toolbar.
