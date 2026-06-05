# @contentgrid/ui

Shared UI component library for ContentGrid Navigator. Contains:

- **Primitives** (`src/primitives/`) — owned copies of shadcn/ui components backed by Radix UI.
- **Patterns** (`src/patterns/`) — composed Navigator-domain components built on the primitives.

Consumed by all three delivery tracks (generic, experimental, custom) via `pnpm workspace:*`.

---

## ContentGrid shadcn registry

`packages/ui/registry.json` defines a [shadcn-compatible registry](https://ui.shadcn.com/docs/registry) for all seven Navigator patterns. It enables external consumers (future custom-track repos) to scaffold patterns via `shadcn add @contentgrid/<name>` once the registry is published.

**Publish is deferred** — per [ADR-008](../../docs/adr/ADR-008-console-scope-ui-publish-trigger.md), `@contentgrid/ui` (and the registry endpoint) are published only when the ContentGrid console adopts the package.

### External registry URL (placeholder — not yet live)

```
https://ui.contentgrid.com/r/{name}.json
```

Each pattern resolves to e.g. `https://ui.contentgrid.com/r/entity-card.json`.
The catalog lives at `https://ui.contentgrid.com/r/registry.json`.
These URLs are **placeholders** and do not exist until publishing is triggered per ADR-008.

---

## Adding a pattern — in-monorepo

Because `shadcn` does not support `file://` URLs for local registries, you must serve the built registry over HTTP first.

**Step 1 — build the registry** (if you have not done so, or after any change):

```
pnpm registry:build
```

This runs `shadcn build registry.json --output r` in `packages/ui` and writes one JSON file per item into `packages/ui/r/`.

**Step 2 — serve the registry locally** (one-time, leave running in a separate terminal):

```
cd packages/ui && python3 -m http.server 4321 --directory r
```

**Step 3 — configure the app's `components.json`** to point at `localhost` while the server is running.
Both `apps/navigator/components.json` and `apps/navigator-experimental/components.json` have a `registries` block. Temporarily change the `@contentgrid` URL to:

```json
"registries": {
  "@contentgrid": "http://localhost:4321/{name}.json"
}
```

**Step 4 — add the pattern**:

```
pnpm shadcn add @contentgrid/entity-card --cwd apps/navigator --yes
```

**Step 5 — revert the URL** in `components.json` back to the placeholder:

```json
"registries": {
  "@contentgrid": "https://ui.contentgrid.com/r/{name}.json"
}
```

> **Tip:** You can also bypass the registry and add a pattern directly by path:
>
> ```
> pnpm shadcn add packages/ui/r/entity-card.json --cwd apps/navigator --yes
> ```
>
> No server required. The `--yes` flag skips the confirmation prompt.

---

## Rebuilding the registry

Run from the repo root:

```
pnpm registry:build
```

Or directly in `packages/ui`:

```
pnpm --filter @contentgrid/ui registry:build
```

The build reads `packages/ui/registry.json` and writes `packages/ui/r/<name>.json` for every item (patterns + their primitive dependencies). The `r/` directory is committed and must be rebuilt after any change to `registry.json` or the source files it references.

---

## Registry design: registryDependencies

All seven patterns declare `registryDependencies` referencing our **own copies** of the shadcn primitives (e.g. `"button"`, `"card"`) rather than pointing at the upstream `https://ui.shadcn.com/r/` registry.

**Rationale:** The primitives in `packages/ui/src/primitives/` are owned copies — they may diverge from upstream shadcn. Pointing external consumers at the upstream registry would scaffold the upstream version, not ours. By declaring the primitives as our own registry items (`type: "registry:ui"`) with their source files embedded, `shadcn add @contentgrid/entity-card` scaffolds both the pattern and its primitive dependencies from our registry in one command.

**Trade-off:** Custom-track repos that already have their own copies of `button` etc. will see those files overwritten on first add. Use `--diff` to preview before applying.

---

## Available patterns

| Registry name      | Component         | npm deps               | Primitives used                                                          |
| ------------------ | ----------------- | ---------------------- | ------------------------------------------------------------------------ |
| `branding-header`  | `BrandingHeader`  | —                      | separator                                                                |
| `data-table`       | `DataTable`       | lucide-react           | alert-dialog, button, dropdown-menu, table, tooltip                      |
| `entity-card`      | `EntityCard`      | lucide-react           | button, card                                                             |
| `entity-picker`    | `EntityPicker`    | lucide-react           | button, dialog, input, skeleton, table                                   |
| `file-upload-zone` | `FileUploadZone`  | lucide-react           | badge, button                                                            |
| `filter-sidebar`   | `FilterSidebar`   | lucide-react, date-fns | button, input, label, select, separator                                  |
| `relation-section` | `RelationSection` | lucide-react           | alert-dialog, badge, button, card, collapsible, skeleton, table, tooltip |
