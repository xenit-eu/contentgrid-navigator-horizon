# `packages/ui/tokens/`

Design tokens for the ContentGrid UI package. All raw values (colours, spacing,
radii, typography, elevation) live here as CSS custom properties.

## Naming convention

All tokens use the `--cg-<category>-<name>` prefix.

The `--cg-` prefix is deliberate:

- **Collision avoidance** — shadcn/ui ships its own CSS variables (`--background`,
  `--primary`, `--ring`, etc.). Tailwind v4 uses its own `--color-*` / `--radius-*`
  namespace. A unique `--cg-` prefix means you can use all three sets in the same
  document without any name conflicts.
- **Discoverability** — `--cg-` tokens are easy to grep for and to distinguish
  from vendor variables in DevTools.

## Token categories

| Prefix               | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| `--cg-color-*`       | Raw colour palette (blues, neutrals, text, status, chrome)    |
| `--cg-space-*`       | Spacing scale (4 / 8 / 16 / 24 / 32 / 64 px)                  |
| `--cg-radius-*`      | Border-radius scale (sm / md / lg / base)                     |
| `--cg-font-size-*`   | Font sizes (xs → 2xl)                                         |
| `--cg-line-height-*` | Matching line heights — always pair with the same size suffix |
| `--cg-shadow-*`      | Elevation / box-shadow                                        |

## Colour palette notes

Values follow the reference design (light theme). Dark theme is unchanged.

| Token                      | Value     | Role                                                                      |
| -------------------------- | --------- | ------------------------------------------------------------------------- |
| `--cg-color-line`          | `#e3e9ef` | Default borders and dividers                                              |
| `--cg-color-line-strong`   | `#cfd9e2` | The design's "line2": inputs, outlined buttons, switch tracks (`--input`) |
| `--cg-color-frost`         | `#ffffff` | Card / popover surface                                                    |
| `--cg-color-text-muted`    | `#4f6f87` | Muted text; design's #557891 is 4.36:1 on mist (below AA), so kept darker |
| `--cg-color-amber`         | `#b85b1f` | Warning hue (4.61:1 on white, AA for small text)                          |
| `--cg-color-amber-light`   | `#7a3d14` | Dark text on the amber tint (7.36:1 on `#fbeee3`)                         |
| `--cg-color-sky-50`        | `#e6f4fc` | Sky tint: selected / active / info (`--secondary`, `--accent`)            |
| `--cg-color-sky-tint-line` | `#b5def5` | Border that pairs with the sky tint                                       |
| `--cg-color-header-end`    | `#0b6aa6` | End of the app header gradient (`ocean-700` > `ocean` at 55% > this)      |
| `--cg-color-brand-accent`  | `#7fd0f7` | "grid" half of the brand name in the header                               |
| `--cg-color-header-sub`    | `#bcd6e8` | "BY AMEXIO" line under the brand name                                     |
| `--cg-color-amber-tint`    | `#fbeee3` | Warning surface tint                                                      |
| `--cg-color-danger-tint`   | `#fbe9e7` | Danger surface tint                                                       |
| `--cg-color-green-tint`    | `#e4f3ea` | Success surface tint                                                      |

The tints are available as unprefixed aliases (`--amber-tint`, `--danger-tint`,
`--green-tint`, `--sky-tint-line`, `--line-strong`) but are not yet wired to
Tailwind utilities or consumed by components.

## How tokens flow to consumers

```
tokens/index.css          raw --cg-* values
       ↓  (@import)
src/styles/preset.css     backward-compat aliases (--ocean, --sky, …)
                          + shadcn semantic layer (--background, --primary, …)
                          + Tailwind @theme inline (--color-primary, --radius-sm, …)
       ↓  (@import "@contentgrid/ui/styles/preset.css")
apps/*/src/index.css      apps get everything transitively — no extra imports needed
```

Consumers **do not** need to import `tokens/index.css` themselves. The preset
already does it. If you want to reference a `--cg-*` token directly in
application CSS, the value is available on `:root` once the preset is loaded.

## Adding or changing tokens

1. Edit `tokens/index.css` — this is the single source of truth for raw values.
2. If you're adding a new semantic alias (e.g. a new shadcn variable), add it in
   `src/styles/preset.css` pointing at a `--cg-*` token.
3. Typography tokens (`--cg-font-size-*`, `--cg-line-height-*`) are net-new and
   not yet wired to Tailwind utilities; use them directly in CSS until a Tailwind
   mapping is added.

## Dark mode

Dark theme tokens are **out of scope for HZN-3.2** and will be addressed in a
follow-up. When dark mode is added, override the `--cg-*` tokens (or the shadcn
semantic vars) inside a `.dark` selector in `preset.css`.
