# Data Model: Create Item Page and Upload into Empty Content Attributes

**Feature**: [spec.md](spec.md) | **Date**: 2026-09-30

No server-side data changes. All shapes below are client-side.

## Option (`IconBadgeOption`, `@contentgrid/ui`)

| Field         | Type         | Rule                                                     |
| ------------- | ------------ | -------------------------------------------------------- |
| `name`        | `string`     | Identity and selection value; the entity's profile name. |
| `title`       | `string`     | Display label.                                           |
| `description` | `string?`    | Muted second line in option rows; omitted when empty.    |
| `icon`        | `ReactNode?` | Rendered left of the title; the caller supplies it.      |

Mapping in features (`EntityProfileSelector` / `EntityProfileSelectorList`, internal): `ProfileEntity` → `{ name: profile.name, title: profile.title, description: profile.description || undefined, icon: <EntityIconBadge profile={profile} variant="sm" muted /> }`.

## Create item page state (`ClassifyCreateEntityItemView`)

| Field             | Type                         | Initial     | Transitions                                                                       |
| ----------------- | ---------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `selectedProfile` | `ProfileEntity \| undefined` | `undefined` | set on selection; **Continue** is enabled once set and opens its create form (D4) |
| `initialFile`     | from the store               | store value | drop/browse → `setInitialFile(file)`; remove → `setInitialFile(null)`             |

Entities: `useLoadedProfileEntities()` filtered inline to those with a `createTemplate` (research D11).

View states: `loading` (entities loading) → `empty` (no creatable entity) | `ready`.

## Initial file (Zustand store `useCreateEntityItemState`, `entity-item-create/state`)

| Field         | Type           |
| ------------- | -------------- |
| `initialFile` | `File \| null` |

| Operation                                               | Effect                                      |
| ------------------------------------------------------- | ------------------------------------------- |
| `useCreateEntityItemState((s) => s.initialFile)`        | Reactive read (Create item page drop zone). |
| `useCreateEntityItemState.getState().initialFile`       | Non-reactive read (create form mount).      |
| `useCreateEntityItemState.getState().setInitialFile(f)` | Replaces the value; `null` clears it.       |

Lifecycle: set when the user attaches a file on the Create item page → read by every create form that mounts → cleared on a successful create, or when the user removes the file (on the Create item page or in the form's file field). Kept on cancel and on entity switch. Lost on reload. Cancel on the Create item page never sets it.

## Create form prefill

`initialValues = firstFileField ? { [firstFileField.name]: file } : undefined`, where `firstFileField = fields.find(f => f.kind === "file")`. Applied once on mount; continuous-create resets start empty.

When `firstFileField` is absent nothing is shown and the store is left untouched. On successful create the container calls `setInitialFile(null)` and `formState.reset({})`.

## Empty-attribute upload (content-focus)

`ContentPreviewFrame` state gains `uploading`:

| State                     | Shown                                                                                | Actions                |
| ------------------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| `noFile` + may upload     | drop zone + "No file"                                                                | drop / browse → upload |
| `noFile` + may not upload | "No file"                                                                            | none                   |
| `uploading` (new)         | skeleton + "Uploading…"                                                              | none                   |
| `noFile` + upload error   | problem alert + drop zone                                                            | drop / browse → upload |
| after success             | the item's new file → normal preview states (`loading` → `ready` / rendition states) | as in 002              |

Upload error on 412 (`unsatisfied-version`): `useUploadContent` invalidates the item query (research D10), so the newer version and its ETag load and the next drop can succeed.
