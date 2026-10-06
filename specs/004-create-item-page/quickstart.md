# Quickstart: Create Item Page and Upload into Empty Content Attributes

**Feature**: [spec.md](spec.md)

## Run

```bash
pnpm install --frozen-lockfile
pnpm dev:navigator            # MSW fixtures in development mode
# or: pnpm dev:navigator-experimental
```

## Check by hand

### Create item page and entity switch (US1, US2, US4)

1. Click **Create Item** in the sidebar → the Create Item page opens.
2. The **Entity** list shows only entities with a create form, each with icon, name and description; **Continue** is disabled.
3. Choose an entity → it gets a check mark; press **Continue** → its create form opens; go back to the Create Item page.
4. Drop a PDF on **Upload a file (optional)** → its name and size are shown; remove it and drop it again.
5. Choose an entity with a file field → its create form opens with the PDF in its first file field.
6. Reload the create form → the file is gone (memory only).
7. Back on the Create item page (the file is still shown), choose an entity without a file field → its create form opens without the file and without a message.
8. On that create form, switch entity in the toolbar to one with a file field → the file is in its file field.
9. Create the item → open Create again: no file attached.
10. With unsaved changes, switch entity in the toolbar → the unsaved-changes dialog appears.
11. Cancel → back to the previous page.

### Upload into an empty content attribute (US3)

1. Open an item whose content attribute has no file → drop zone with "No file".
2. Drop a PDF → "Uploading…" → the PDF renders; file name, size and type are updated in the side panel.
3. With a fixture where the `cg:content` link is absent → only "No file", no drop zone.
4. With a fixture answering 412 → "modified" problem shown, item reloaded, drop zone back.

## Automated checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```
