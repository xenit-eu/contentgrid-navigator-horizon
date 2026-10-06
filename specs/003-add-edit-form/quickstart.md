# Quickstart: verify the edit form

**Feature**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

## Prerequisites

- `pnpm install` (frozen lockfile).
- Mock API: `apps/navigator/.env.development` has `VITE_USE_MOCK_API=true`. A local `.env.development.local` with `VITE_USE_MOCK_API=false` overrides it; remove or edit that file to use the mocks.
- For a real backend: `.env.development.local` with `VITE_USE_MOCK_API=false` and the application's OIDC settings.

## Automated checks

```sh
pnpm typecheck && pnpm lint
pnpm test -- packages/navigator-data packages/features   # unit, hook and MSW contract tests (root vitest)
```

PR 1 has no e2e test: the demo MSW data has no item `default` templates, so the Edit action does not appear in mock mode. The scenarios below are run against a real backend.

## Manual scenarios — PR 1 (dev server: `pnpm dev:navigator`)

| #   | Steps                                                                                                              | Expected                                                                                                      | Spec          |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | Open an item of an entity with text, number, boolean, date, datetime and allowed-values attributes. Click **Edit** | Form replaces the attribute panel in place, every field pre-filled, required fields marked `*`                | US1-1, 3      |
| 2   | Change one value of each type, **Save**                                                                            | Toast "… has been successfully updated!", panel back to view mode with the new values, no flash of old values | US1-4         |
| 3   | Change a value, **Cancel**                                                                                         | Confirmation; confirming restores the original values                                                         | US1-5         |
| 4   | Clear a required field, **Save**                                                                                   | Blocked, field shows the error, no request sent                                                               | US1-7         |
| 5   | Open an item without update permission                                                                             | No Edit action                                                                                                | US1-2, SC-006 |
| 6   | Edit an item in a second tab and save there; save the first tab                                                    | Conflict alert, latest values loaded, own changes kept; saving again succeeds                                 | US3-2         |
| 7   | Send a value the server rejects                                                                                    | Error inline on that field; errors without a field above the form                                             | US3-1         |
| 8   | Delete the item in a second tab; save the first tab                                                                | Not-found alert, Save disabled, only Cancel                                                                   | US3-4         |
| 9   | While editing, go offline, switch tabs and come back                                                               | "This item could not be refreshed" with Retry; the form keeps its input; Retry once online clears it          | SC-005        |

## Manual scenarios — PR 2

| #   | Steps                                                                 | Expected                                                                                               | Spec  |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----- |
| 10  | Content-focus item: **Edit**, drop a new PDF on its content attribute | Preview shows the picked PDF; filename/mimetype follow it; nothing uploaded yet (network tab)          | US2-2 |
| 11  | **Save**                                                              | Metadata PUT, then content PUT with progress, then item reload; preview and download show the new file | US2-5 |
| 12  | **Edit**, remove the file, **Save**                                   | Content DELETE sent; attribute shows "No file"                                                         | US2-4 |
| 13  | **Edit**, rename the file only, **Save**                              | Same bytes, new name in download and panel                                                             | US2-6 |
| 14  | Content PUT fails after a successful metadata PUT                     | Edit mode stays open, file flagged with Retry; Retry uploads only that file                            | US3-5 |

Per the constitution's quality gates, the scenarios of a PR are run in a browser before it is reported done; any scenario that cannot be run is stated explicitly.
