# Implementation Plan: Add Edit Form

**Branch**: `ACC-3210-edit-form-metadata` | **Date**: 2026-10-05 (revised from 2026-09-29) | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-add-edit-form/spec.md`

## Summary

Add an edit mode to the entity item detail page. Choosing Edit swaps the item's attribute panel for a form generated from the item's `default` HAL-FORMS template, prefilled from the item body through the template's codec. The form renders through the `hal-forms` feature (ADR-004, amended 2026-10-01), the same way the create form does.

The feature ships in two PRs (spec § Delivery):

- **PR 1 — metadata edit** (this plan, detailed below): Edit action, edit mode in both layouts, prefill, client validation, conditional PUT, success toast, every failure state of the metadata request. Branches from `main` now.
- **PR 2 — file changes** (outline at the end): replace/remove a file, queued until Save, upload progress, local preview. Branches from `main` after the ACC-3217 stack merges, because it changes `use-content.ts`, `file-upload-zone.tsx` and the content-preview components that stack also changes.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19

**Primary Dependencies**: TanStack Query (server state), TanStack Router (`useBlocker` through `useUnsavedChangesGuard`; no new route), `@contentgrid/hal-forms` 0.4.2 codecs (`encode` and `decode`) via `@contentgrid/navigator-data`, shadcn/ui + Tailwind 4 in `@contentgrid/ui`, sonner (toasts)

**Storage**: N/A (ContentGrid REST API; item metadata PUT)

**Testing**: Vitest + Testing Library (unit, hook), MSW (HAL contract tests); manual verification against a real backend

**Target Platform**: evergreen desktop and mobile browsers

**Project Type**: pnpm monorepo web frontend

**Performance Goals**: edit mode opens without a network request (item already loaded); SC-002

**Constraints**: constitution principles I–VIII; no new dependencies; no new route (FR-003); only the changes this feature needs, no unrelated clean-ups

**Scale/Scope**: every entity of any application; forms up to ~50 properties

## Constitution Check

_GATE: Must pass before implementation. Scope: PR 1._

| Principle         | Check                                                                                                                                                                                                                   | Status     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| I. HAL only       | PUT built by `editEntityRequest` from the `default` template codec; values through `createValues`; `If-Match` from `entityItem.etag` (existing `useUpdateEntityItem`); 412 surfaced, never auto-retried in the hook     | ✅         |
| II. Model-first   | Form generated from the template; no attribute names in code; prefill decoded by the template codec, not mapped by hand                                                                                                 | ✅         |
| III. Boundaries   | Template wrapper and decode in `navigator-data`; edit container/form in `features`; no new `ui` pattern; no Layer-1 import from `features`                                                                              | ✅         |
| IV. Stability     | Lives inside the `stable` `entity-item` feature (`entity-item/edit/`), its only user; no new feature directory                                                                                                          | ✅         |
| V. ABAC           | Edit gated on `entityItem.canUpdate` (`_templates.default` presence); 403 after submit shown as a policy outcome (FR-022)                                                                                               | ✅         |
| VI. Auth          | No change; requests go through `apiFetch`                                                                                                                                                                               | ✅         |
| VII. Supply chain | No new dependency                                                                                                                                                                                                       | ✅         |
| VIII. Views       | Edit mode owned by the views; no app change                                                                                                                                                                             | ✅         |
| Error handling    | Non-field errors through `ProblemAlert` (412: initial values updated to the latest version); field errors through `getValidationFieldErrors` → `toServerFieldErrors`; same split as the create form, shared, not copied | ✅         |
| Quality gates     | MSW tests for prefill, PUT + `If-Match`, 400 and 412; unit tests for decode and changed values; browser run against a real backend                                                                                      | ✅ planned |

The content DELETE deviation recorded in the 2026-09-29 plan (D2) belongs to PR 2 and is not part of this gate.

## Project Structure

### Documentation (this feature)

```text
specs/003-add-edit-form/
├── plan.md              # This file (PR 1 detailed, PR 2 outline)
├── research.md          # Legacy analysis + decisions
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
├── src/accessors/extended-forms/create-form.ts   # uses toFormAttributeProperty
├── src/accessors/entity-item.ts                  # + updateTemplate (cached), updateFormValues
├── src/hooks/item/use-reload-entity-item.ts      # NEW reload the latest item into the cache (412 re-fetch)
├── src/hooks/item/use-update-entity.ts           # PUT answers 204: fetchVoid, then invalidate the item (D13)
├── src/hooks/item/use-update-entity.test.tsx     # hook tests (replaces a stale copy of the useEntityItem tests)
├── src/index.ts, src/hooks/index.ts              # export UpdateHalFormTemplate, FormAttributeProperty, useReloadEntityItem
├── test-fixtures/hal/all-attribute-item.ts  # NEW makeAllAttributeItem, shared by data-layer and feature tests
├── test-fixtures/hal/fixtures.ts, contract.test.ts  # invoiceUpdateTemplate method PUT
├── test-fixtures/msw/handlers.ts                 # createUpdateHandler matches PUT
└── CLAUDE.md                                     # ETag section: item PUT is a 204 mutation; useReloadEntityItem

packages/features/src/
├── hal-forms/
│   ├── model/resolve-hal-forms-fields.ts         # accepts UpdateHalFormTemplate (create-path mapping)
│   ├── state/get-form-alert-error.ts           # NEW, extracted from create-entity-item-container (D12)
│   └── state/use-hal-forms-field-state.ts        # + updateInitialValues(initialValues) (D11)
├── entity-item-create/create-entity-item-container.tsx  # uses getFormAlertError
└── entity-item/
    ├── CLAUDE.md                                 # scope and layering of edit/
    ├── edit/
    │   ├── edit-entity-item-view.tsx             # guard + dialog
    │   ├── edit-entity-item-container.tsx        # edited item, updateInitialValues after 412; prefill, useUpdateEntityItem, errors
    │   └── edit-entity-item-form.tsx             # <form>, fields, Save/Cancel
    ├── attributes/entity-item-attributes-panel.tsx  # NEW "Attributes" heading + Edit, edit mode
    ├── entity-item-view.tsx                      # renders the panel
    └── variations/content-focus/views/entity-item-content-focus-view.tsx  # same, in the side panel
```

No change to `use-content.ts`, `file-upload-zone.tsx`, the content-preview components, the apps or any `ui` pattern in PR 1.

## PR 1 — design

### Entry and edit mode (FR-001, FR-003)

- Both views show an **Attributes** heading above the attribute panel, styled like the **Relations** heading, with an **Edit** button (outline, pencil icon) at its right, the same way the relation sections place "+ Link" (D14). Shown when `item.canUpdate`: the item has an update template (FR-001). The views are only rendered by the detail routes today, so FR-002 needs no opt-out prop yet.
- `editing` is state of `EntityItemAttributesPanel`, which both views render keyed by `<profile name>/<item id>`, so edit mode never carries over to another item. While editing, the Edit button hides and `EntityItemAttributes` is replaced by `EditEntityItemView`; the header, relation sections and content preview stay mounted.
- `EditEntityItemView` owns `useUnsavedChangesGuard(isDirty)` and `UnsavedChangesDialog`, as `CreateEntityItemView` does. Cancel with unsaved changes opens the same dialog; without changes it leaves edit mode at once (US1-5, US1-6).
- The form uses the create form's Save/Cancel button row; the pinned action bar, edit-mode heading and transition (FR-003a, FR-003b) are not part of PR 1 (spec § Delivery).

### Form (FR-004–FR-007)

- `resolveHalFormsFields(updateTemplate)` produces fields and the default one-field-per-row layout, in template order.
- Content attributes appear on the `default` template as `<attr>.filename` and `<attr>.mimetype` text properties. **PR 1 renders them as the plain text fields the template describes** (D10); PR 2 folds them into the file field.
- `initialValues` = `entityItem.updateFormValues`: the item body decoded through the template codec (`requireCodecFor(template).decode({ contentType, body }).valueMap`), as the legacy `createFormValues` does. Datetimes decode to `Date`, which the `datetime` renderer accepts.
- `useHalFormsFieldState({ fields, initialValues, externalErrors })` gives values, dirty tracking, validation and `buildValues`. `buildValues` sends every non-empty value, so untouched values, including the stored filename/mimetype, are sent back unchanged. That matters because the PUT replaces the whole item (FR-014, ACC-1411). A cleared field is left out of the body, and the PUT clears it; the HAL-FORMS codec has no way to send `null`.

### Save (FR-013, FR-016–FR-019)

1. `validate()`; stop on a client error.
2. `useUpdateEntityItem(item).mutate(buildValues(updateTemplate.template))`. The hook sends the PUT with `If-Match: item.etag`. The server answers **204 No Content**, so the hook re-fetches the item through `EntityItem.fetchByUrlQuery` (which writes `entityItem.byUrl`) and invalidates the entity's collections (D13).
3. On success: `toast.success("<Entity> has been successfully updated!")`, leave edit mode. The page reads the re-fetched item already in the cache, so the old values never flash back (FR-016).

Save is disabled and labelled "Saving…" while pending.

### Failures (FR-021–FR-023, FR-025)

| Response                    | Behaviour                                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400 `input/validation`      | Field-scoped errors inline through `toServerFieldErrors`; the rest in `ProblemAlert` above the form (shared selector, D12). Input kept                                                                                                              |
| 412 `unsatisfied-version`   | `VersionConflictAlert` above the form. The item is refetched; the form's initial values are updated to the latest version with the user's changed fields kept on top, and keeps the alert until the next save (D11). Saving again uses the new ETag |
| 403                         | `ProblemAlert`, form open, input kept                                                                                                                                                                                                               |
| 404 `not-found/entity-item` | `ProblemAlert`; Save disabled, only Cancel offered                                                                                                                                                                                                  |
| Network / other             | `ProblemAlert`, input kept                                                                                                                                                                                                                          |

The 412 notice uses the form's alert slot like every other non-field error, not a toast. The form is not rebuilt, so the alert (the mutation's error) stays until the next save.

### Data layer

- `UpdateHalFormTemplate` wraps `entityItem.defaultTemplate` with the item's `ProfileEntity`, like the create and search wrappers wrap only their template. It exposes `userDefinedProperties` (`FormAttributeProperty`, the shape formerly named `CreateFormProperty`; the classification moved into `toFormAttributeProperty`, shared with `CreateHalFormTemplate`). It has no relation properties: the `default` template carries none.
- `entityItem.updateFormValues` decodes the item body through the `default` template's codec for prefill; `null` without the template.
- `useReloadEntityItem(item)` returns a function that GETs the item's self link into the item cache (no retries) and resolves with the latest `EntityItem`; the container uses it after a 412. `useUpdateEntityItem` invalidates the item after a successful PUT instead (D13).
- `entityItem.updateTemplate` returns it (cached per item), or `null` when the template is absent.
- MSW `createUpdateHandler` matched `PATCH`; it now matches `PUT`, the `default` template's method.

### Tests

- `update-form.test.ts`: `null` without a `default` template.
- `edit-entity-item-container.test.tsx` (MSW): prefill; Save sends a PUT with `If-Match` and every value; 204 then success toast; 400 shown inline; 412 reloads the item and keeps only the user's own changes on top (an empty field someone else filled in is not cleared), and the next save uses the new ETag; 404 disables Save.

No e2e test in PR 1: the demo MSW data has no `default` templates, so the Edit action cannot appear in mock mode. Verified by hand against a real backend instead.

No tests that only check a click calls a callback.

## Resolved during PR 1

- **PUT response**: the real backend answers item PUT with 204 No Content. `useUpdateEntityItem` now re-fetches the item (D13). Before the fix, a successful save failed in the client ("Unexpected end of JSON input") and left the old ETag cached, so the next save got a 412.
- **Datetime prefill**: the codec decodes datetimes to `Date`; the `datetime` renderer accepts it.
- **Cleared values**: `buildValues` omits empty values; still to confirm that a PUT without a property clears it on the server.

## PR 2 — outline (after ACC-3217 merges)

Unchanged from the 2026-09-29 plan, adjusted to `hal-forms`:

- One `file` field per content attribute, found with `attr.isContent`, replacing the two text fields from PR 1. Gated on `canUploadContent` / `canDeleteContent`.
- Picking or removing a file only queues it; `<attr>.filename`/`<attr>.mimetype` follow the picked file. On Save the metadata PUT sends the stored values (legacy `resetSymbol`), then each file step runs in order with the ETag of the step before (D1). Removing a file uses DELETE on the `cg:content` link (D2, constitution amendment in that PR).
- XHR upload progress and `cancel()` in `useUploadContent`; retry by calling `mutate` again with the same `File`; 412 and 415 handled at the call site. This closes HZN-5D.12.
- Local preview of a picked PDF in the content-focus layout (D7).

## Complexity Tracking

None for PR 1. PR 2 carries the content DELETE deviation (research D2).
