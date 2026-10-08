# Implementation Plan: Add Edit Form

**Branch**: `003-add-edit-form` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-add-edit-form/spec.md`

## Summary

Add an edit mode to the entity item detail page. Choosing Edit swaps the item's attribute panel for a form generated from the item's `default` HAL-FORMS template, prefilled from the item body through the template's codec. The form renders through the `hal-forms` feature (ADR-004, amended 2026-10-01), the same way the create form does.

The feature ships in two PRs (spec § Delivery):

- **PR 1 — metadata edit** (this plan, detailed below): Edit action, edit mode in both layouts, prefill, client validation, conditional PUT, success toast, every failure state of the metadata request.
- **PR 2 — file changes** (outline at the end): replace/remove a file, queued until Save, upload progress, local preview. Starts after `004-create-item-page` merges, because both change `use-content.ts`, `file-upload-zone.tsx` and the content-preview components.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19

**Primary Dependencies**: TanStack Query (server state), TanStack Router (`useBlocker` through `useUnsavedChangesGuard`; no new route), `@contentgrid/hal-forms` 0.4.2 codecs (`encode` and `decode`) via `@contentgrid/navigator-data`, shadcn/ui + Tailwind 4 in `@contentgrid/ui`, sonner (toasts)

**Storage**: N/A (ContentGrid REST API; item metadata PUT)

**Testing**: Vitest + Testing Library (unit, hook), MSW (HAL contract tests); manual verification against a real backend

**Target Platform**: evergreen desktop and mobile browsers

**Project Type**: pnpm monorepo web frontend

**Performance Goals**: edit mode opens without a network request (item already loaded); SC-002

**Constraints**: constitution principles I–IX; no new dependencies; no new route (FR-003); only the changes this feature needs, no unrelated clean-ups

**Scale/Scope**: every entity of any application; forms up to ~50 properties

## Constitution Check

_GATE: Must pass before implementation. Scope: PR 1._

| Principle         | Check                                                                                                                                                                                                               | Status     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| I. HAL only       | PUT built by `editEntityRequest` from the `default` template codec; values through `createValues`; `If-Match` from `entityItem.etag` (existing `useUpdateEntityItem`); 412 surfaced, never auto-retried in the hook | ✅         |
| II. Model-first   | Form generated from the template; no attribute names in code; prefill decoded by the template codec, not mapped by hand                                                                                             | ✅         |
| III. Boundaries   | Template wrapper and decode in `navigator-data`; edit container/form in `features`; no new `ui` pattern; no Layer-1 import from `features`                                                                          | ✅         |
| IV. Stability     | Lives inside the `stable` `entity-item` feature (`entity-item/edit/`), its only user; no new feature directory                                                                                                      | ✅         |
| V. ABAC           | Edit gated on `entityItem.updateTemplate` (`_templates.default` presence) with at least one property; 403 after submit shown as a policy outcome (FR-022)                                                           | ✅         |
| VI. Auth          | No change; requests go through `apiFetch`                                                                                                                                                                           | ✅         |
| VII. Supply chain | No new dependency                                                                                                                                                                                                   | ✅         |
| VIII. Views       | Edit mode owned by the views; no app change                                                                                                                                                                         | ✅         |
| IX. Traceability  | Every PR 1 change maps to an FR, SC or decision below; the spec artifacts describe what was built; no references to files outside the repository                                                                    | ✅         |
| Error handling    | Non-field errors through `ProblemAlert` (412: Refresh reloads the item in the view); field errors through `getValidationFieldErrors` → `toServerFieldErrors`; same split as the create form                         | ✅         |
| Quality gates     | MSW tests for prefill, PUT + `If-Match`, 400 and 412; unit tests for decode; browser run against a real backend                                                                                                     | ✅ planned |

The content DELETE deviation (D2) belongs to PR 2 and is not part of this gate.

## Project Structure

### Documentation (this feature)

```text
specs/003-add-edit-form/
├── plan.md              # This file (PR 1 detailed, PR 2 outline)
├── research.md          # Original Navigator analysis + decisions
├── data-model.md        # Edit session, save flow, state transitions
├── quickstart.md        # How to verify
├── contracts/
│   ├── navigator-data.md
│   ├── features.md
│   └── ui.md            # PR 2 only
└── checklists/requirements.md
```

### Source code — PR 1 (as implemented)

```text
packages/navigator-data/
├── src/accessors/extended-forms/update-form.ts   # NEW UpdateHalFormTemplate (D9)
├── src/accessors/extended-forms/form-property.ts # NEW FormAttributeProperty + toFormAttributeProperty, shared by create and update (D9)
├── src/accessors/extended-forms/create-form.ts   # uses toFormAttributeProperty; unused contentProperties removed (+ its test)
├── src/accessors/entity-item.ts                  # + updateTemplate (cached), updateFormValues
├── src/hooks/item/use-update-entity.ts           # PUT answers 204: fetchVoid, then invalidate the item (D13)
├── src/hooks/item/use-update-entity.test.tsx     # hook tests (replaces a stale copy of the useEntityItem tests)
├── src/index.ts, src/hooks/index.ts              # export UpdateHalFormTemplate, FormAttributeProperty
├── test-fixtures/hal/all-attribute-item.ts  # NEW makeAllAttributeItem, shared by data-layer and feature tests
├── test-fixtures/hal/fixtures.ts, contract.test.ts  # invoiceUpdateTemplate method PUT
├── test-fixtures/msw/handlers.ts                 # createUpdateHandler matches PUT (+ handlers.test.ts)
└── CLAUDE.md                                     # ETag section: item PUT is a 204 mutation

packages/features/src/
├── hal-forms/
│   ├── model/resolve-hal-forms-fields.ts         # accepts UpdateHalFormTemplate (create-path mapping)
│   └── state/use-hal-forms-field-state.ts        # dates compare by time in isDirty
├── entity-item-create/create-entity-item-container.tsx  # validation problem on the fields, other errors in the alert (D12)
├── problem-details/version-conflict-alert.tsx    # 412: "This item has been updated by someone else", Refresh (D11)
└── entity-item/
    ├── CLAUDE.md                                 # scope and layering of edit/
    ├── edit/
    │   ├── use-edit-mode.ts                      # NEW edit mode of the shown item, owned by the views
    │   ├── editable-entity-item.ts               # NEW EditableEntityItem, isEditableEntityItem
    │   ├── edit-entity-item-button.tsx           # NEW Edit, a boxed pencil at the right of the item's title row
    │   ├── edit-entity-item-container.tsx        # NEW prefill, useUpdateEntityItem, errors, unsaved-changes guard; 412 Refresh → onRefresh
    │   └── edit-entity-item-form.tsx             # NEW <form>, fields, Save/Cancel
    ├── attributes/editable-entity-item-attributes.tsx  # NEW attributes, or the form while editing (keyed by the edited version's ETag)
    ├── entity-item-view.tsx                      # edit mode, Edit in the header; keeps a loaded item on a failed refetch
    └── variations/content-focus/views/entity-item-content-focus-view.tsx  # same, Edit in the side panel header (test item mock gets selfLink and updateTemplate: null)
```

No change to `use-content.ts`, `file-upload-zone.tsx`, the content-preview components, the apps or any `ui` pattern in PR 1.

## PR 1 — design

### Entry and edit mode (FR-001, FR-003)

- Both views show an **Edit** icon button (a pencil on a filled primary-colored rounded box (the `ui` Button `default` variant), with an "Edit" tooltip and accessible name) at the right of the item's title row (D14), when the item has an update template (FR-001) with at least one property (spec edge case: an update form with no properties offers nothing to change). There is no "Attributes" heading. The views are only rendered by the detail routes today, so FR-002 needs no opt-out prop yet.
- Edit mode is view state (`useEditMode(item, refetch)`): the version the form was opened on, tied to the item's self link, so it never carries over to another item and stays closed on coming back. A background refetch leaves the open form on that version. The views pass the edited version as `item`, `isEditing`/`onEditingChange` and `onRefresh` (`useEditMode`'s `refresh`) to `EditableEntityItemAttributes`. While editing, the Edit button hides and `EntityItemAttributes` is replaced by `EditEntityItemContainer`; the header, relation sections and content preview stay mounted.
- `EditEntityItemContainer` owns `useUnsavedChangesGuard(formState.isDirty)` and `UnsavedChangesDialog`, as `CreateEntityItemView` does. Cancel with unsaved changes opens the same dialog; without changes it leaves edit mode at once (US1-5, US1-6).
- The form uses the create form's Save/Cancel button row; the pinned action bar, edit-mode heading and transition (FR-003a, FR-003b) are not part of PR 1 (spec § Delivery).

### Form (FR-004–FR-007)

- `resolveHalFormsFields(updateTemplate)` produces fields and the default one-field-per-row layout, in template order.
- Content attributes appear on the `default` template as `<attr>.filename` and `<attr>.mimetype` text properties. **PR 1 renders them as the plain text fields the template describes** (D10); PR 2 folds them into the file field.
- `initialValues` = `entityItem.updateFormValues`: the item body decoded through the template codec (`requireCodecFor(template).decode({ contentType, body }).valueMap`). Datetimes decode to `Date`, which the `datetime` renderer accepts.
- `useHalFormsFieldState({ fields, initialValues, externalErrors })` gives values, dirty tracking, validation and `buildValues`. `buildValues` sends every non-empty value, so untouched values, including the stored filename/mimetype, are sent back unchanged. That matters because the PUT replaces the whole item (FR-014). A cleared field is left out of the body, since the HAL-FORMS codec has no way to send `null`; whether the server then clears it is an open question (below).

### Save (FR-013, FR-016–FR-019)

1. `validate()`; stop on a client error.
2. `useUpdateEntityItem(item).mutate(buildValues(updateTemplate.template))`. The hook sends the PUT with `If-Match: item.etag`. The server answers **204 No Content**, so the hook invalidates the item's `entityItem.byUrl` query, which re-fetches the shown item with its new values and ETag before the mutation settles, and invalidates the entity's collections (D13).
3. On success: `toast.success("<Entity> has been successfully updated!")`, leave edit mode. The page reads the re-fetched item already in the cache, so the old values never flash back (FR-016).

Save is disabled and labelled "Saving…" while pending.

### Failures (FR-021–FR-023, FR-025)

| Response                    | Behaviour                                                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400 `input/validation`      | Inline on their fields through `toServerFieldErrors` (D12). Input kept                                                                                                                 |
| 412 `unsatisfied-version`   | `ProblemAlert` (`VersionConflictAlert`); Save disabled. Refresh asks the view to refetch the item; the form opens again on the latest version, so saving again uses the new ETag (D11) |
| 403                         | `ProblemAlert`, form open, input kept                                                                                                                                                  |
| 404 `not-found/entity-item` | `ProblemAlert`; Save disabled, only Cancel offered                                                                                                                                     |
| Network / other             | `ProblemAlert`, input kept                                                                                                                                                             |

The 412 notice uses the form's alert slot like every other non-field error, not a toast.

### Item refresh while editing (SC-005)

The item query refetches in the background (window focus, relation changes). When a refetch of an already loaded item fails, both views keep the loaded item, and an open edit form with its input, on screen. The error page is only shown for an item that never loaded (D15).

### Data layer

- `UpdateHalFormTemplate` wraps `entityItem.defaultTemplate` with the item's `ProfileEntity`, like the create and search wrappers wrap only their template. It exposes `userDefinedProperties` (`FormAttributeProperty`, the shape formerly named `CreateFormProperty`; the classification moved into `toFormAttributeProperty`, shared with `CreateHalFormTemplate`). It has no relation properties: the `default` template carries none.
- `entityItem.updateFormValues` decodes the item body through the `default` template's codec for prefill; `null` without the template.
- After a 412 the view reloads the item with its own `useEntityItem(...).refetch()` (D11). `useUpdateEntityItem` invalidates the item after a successful PUT instead (D13).
- `CreateHalFormTemplate.contentProperties` had no caller and is removed.
- `entityItem.updateTemplate` returns it (cached per item), or `null` when the template is absent.
- MSW `createUpdateHandler` matched `PATCH`; it now matches `PUT`, the `default` template's method.

### Tests

- `update-form.test.ts`: `null` without a `default` template.
- `update-form.test.ts` also checks that the template's properties are linked to their profile attributes, in template order.
- `use-update-entity.test.tsx` (MSW): PUT with `If-Match`, then the shown item holds the new ETag.
- `edit-entity-item-container.test.tsx` (MSW): prefill; Save sends a PUT with `If-Match` and every value; 204 then success toast; 400 shown inline; 412 offers Refresh, which calls `onRefresh`, and disables Save; 404 disables Save.
- `use-hal-forms-field-state.test.ts`: a date set to the same moment is not a change .
- `editable-entity-item-attributes.test.tsx`: no Edit without an update form, or with one that has no properties; Cancel without changes closes at once; Cancel with changes asks first.
- `entity-item-view.test.tsx` (MSW): a failed background refetch keeps the open form and its input; a successful save leaves edit mode and shows the saved values; on a conflict, Refresh opens the form on the latest version and the next save sends its ETag.

No e2e test in PR 1: the demo MSW data has no `default` templates, so the Edit action cannot appear in mock mode. Verified by hand against a real backend instead.

No tests that only check a click calls a callback.

## Findings from the real backend

- **PUT response**: item PUT answers 204 No Content, so `useUpdateEntityItem` sends it with `fetchVoid` and re-fetches the item through invalidation (D13). Parsing the empty body would fail a successful save and leave the old ETag cached.
- **Datetime prefill**: the codec decodes datetimes to `Date`; the `datetime` renderer accepts it.

## Open questions

- **Cleared values**: `buildValues` omits empty values. Confirm on a real backend that a PUT without a property clears it.

## PR 2 — outline (after `004-create-item-page` merges)

To be detailed against `hal-forms` when PR 2 starts:

- One `file` field per content attribute, found with `attr.isContent`, replacing the two text fields from PR 1. Gated on `canUploadContent` / `canDeleteContent`.
- Picking or removing a file only queues it; `<attr>.filename`/`<attr>.mimetype` follow the picked file. On Save the metadata PUT sends the stored values, then each file step runs in order with the ETag of the step before (D1). Removing a file uses DELETE on the `cg:content` link (D2, constitution amendment in that PR).
- XHR upload progress and `cancel()` in `useUploadContent`; retry by calling `mutate` again with the same `File`; 412 and 415 handled at the call site.
- Local preview of a picked PDF in the content-focus layout (D7).

## Complexity Tracking

None for PR 1. PR 2 carries the content DELETE deviation (research D2).
