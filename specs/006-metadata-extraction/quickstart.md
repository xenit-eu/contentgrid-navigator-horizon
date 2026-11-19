# Quickstart: Extract Metadata into the Create Form

**Feature**: [spec.md](spec.md)

## Run

```bash
pnpm install --frozen-lockfile
pnpm dev:navigator
```

Open `/config`, choose an application preset and turn on **Use mock extract service**, so extraction calls go to the mock extract service.

## Check by hand

### Fill the form (US1)

1. Without an extract service configured, open an entity's create form → no **Extract metadata** action.
2. With the mock extract service, open the create form of an entity with a file field → **Extract metadata** is shown and disabled.
3. Attach a PDF → the action is enabled. Run it with a hint → empty fields are filled and show **Extracted**.
4. Type in a field first, then extract → that field keeps your value.
5. Block the extract request in the browser's dev tools (Network → Block request URL) and extract → an error is shown in the dialog and the form is unchanged.

### Review and apply (US2)

1. Open the **Extracted** tag of a field that was not filled → value, confidence and reason are shown. **Apply** writes the value.
2. **Discard** the extraction → the tags disappear and the values stay.

### Relations (US3)

1. Extract with **Search for candidates** on → a to-one relation with one confident candidate is linked; to-many entries with one candidate each are added.
2. Open a relation with several candidates → pick one → it is linked. Remove it → it is unlinked.

### Report and duplicates (US4–US5)

1. After an extraction, open the report → every extracted attribute (value, confidence, reason) and every related entity is listed.
2. Extract from a file for an item that already exists → a warning appears next to the report; open it → the similar items are listed and open in a new tab.

## Automated

```bash
pnpm --filter @contentgrid/navigator-data test -- extraction extract-service
pnpm --filter @contentgrid/features test -- apply-extraction extract-metadata-action extraction-report possible-duplicates use-hal-forms-field-state
```
