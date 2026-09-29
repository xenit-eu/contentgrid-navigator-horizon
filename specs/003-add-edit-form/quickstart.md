# Quickstart: verify the edit form

**Feature**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

## Prerequisites

- `pnpm install` (frozen lockfile).
- Mock API: `apps/navigator/.env.development` has `VITE_USE_MOCK_API=true`. A local `.env.development.local` with `VITE_USE_MOCK_API=false` overrides it; remove or edit that file to use the mocks.
- For a real backend: `.env.development.local` with `VITE_USE_MOCK_API=false` and the application's OIDC settings.

## Automated checks

```sh
pnpm typecheck && pnpm lint
pnpm test -- packages/navigator-data packages/features packages/ui   # unit, hook and MSW contract tests (root vitest)
pnpm test:storybook                                                # EditActionBar, FileRenderer story play tests
pnpm test:visual                                                   # Playwright story snapshots (light + dark)
pnpm --filter navigator test:e2e -- edit-item                      # e2e scenarios below
```

## Manual scenarios (dev server: `pnpm dev:navigator`)

| #   | Steps                                                                                                              | Expected                                                                                                                         | Spec          |
| --- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | Open an item of an entity with text, number, boolean, date, datetime and allowed-values attributes. Click **Edit** | Form replaces the attribute panel in place, every field pre-filled, required fields marked `*`, Save/Cancel pinned at the bottom | US1-1, 3, 9   |
| 2   | Change one value of each type, **Save**                                                                            | Toast "… has been successfully updated!", panel back to view mode with the new values, no flash of old values                    | US1-4         |
| 3   | Change a value, **Cancel**                                                                                         | Confirmation; confirming restores the original values                                                                            | US1-5         |
| 4   | Clear a required field, **Save**                                                                                   | Blocked, field shows the error, no request sent                                                                                  | US1-7         |
| 5   | Open an item without update permission (mock: item without `_templates.default`)                                   | No Edit action                                                                                                                   | US1-2, SC-006 |
| 6   | Content-focus item: **Edit**, drop a new PDF on its content attribute                                              | Preview shows the picked PDF; filename/mimetype follow it; nothing uploaded yet (network tab)                                    | US2-2         |
| 7   | **Save**                                                                                                           | Metadata PUT, then content PUT with progress, then item reload; preview and download show the new file                           | US2-5         |
| 8   | **Edit**, remove the file, **Save**                                                                                | Content DELETE sent; attribute shows "No file"                                                                                   | US2-4         |
| 9   | **Edit**, rename the file only, **Save**                                                                           | Same bytes, new name in download and panel                                                                                       | US2-6         |
| 10  | Mock 412 on PUT (change the handler's ETag), **Save**                                                              | "Item changed" alert, latest values loaded, own changes kept, hints on fields changed by both                                    | US3-2         |
| 11  | Mock 400 `input/validation` with a field error                                                                     | Error inline on that field; non-field errors above the form                                                                      | US3-1         |
| 12  | Mock content PUT failure after a successful metadata PUT                                                           | Edit mode stays open, file flagged with Retry; Retry uploads only that file                                                      | US3-5         |
| 13  | Mock 403 / 404 on PUT                                                                                              | 403: not-permitted alert, input kept. 404: not-found, only Leave                                                                 | US3-3, 4      |
| 14  | Repeat 1–2 at 375 px width and in dark theme; enable reduced motion                                                | No horizontal scroll, correct theme, no transition                                                                               | FR-003a, 003c |

Per the constitution's quality gates, scenarios 1–14 are run in a browser before the feature is reported done; any scenario that cannot be run is stated explicitly.
