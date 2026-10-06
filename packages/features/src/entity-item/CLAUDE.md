# packages/features/src/entity-item — CLAUDE.md

Feature: `entity-item` · `x-stability: "stable"`

Includes a variation, `variations/content-focus/` (spec `002-pdf-viewer`), that renders an
entity item's content attribute alongside its attributes and relations. `content-focus` was
originally its own `entity-item-content-focus` feature directory and was folded in here at the
reviewer's request — see "Stability of the content-focus variation" below for what that move
means in practice.

## Scope

`entity-item` renders an entity item's attributes and relations: `EntityItemView`,
`EntityItemAttributes`, `RelationToOneSection`, `RelationToManySection`. Its attributes section
(`attributes/entity-item-attributes-panel.tsx`) offers an Edit action when the item has an update
form; `edit/` holds the update form. When a refetch of a loaded item fails, the views keep the
item (and an open edit form) on screen under `EntityItemRefreshAlert`.

Its `content-focus` variation (`variations/content-focus/`, public entry point
`EntityItemContentFocusView`) renders an entity item's content attribute — a PDF, or a non-PDF
previewed through the platform's PDF rendition service — next to those same attributes and
relations, with the production viewer toolbar. `EntityItemContentFocusView` resolves
`entityName`/`itemId` into a `profileEntity`/`EntityItem` itself and falls back to plain
`EntityItemView` for any item with no content attributes (FR-001).

## Stability of the content-focus variation

The three-track model (`packages/features/CLAUDE.md`) gates stability per feature directory —
there is currently no mechanism to flag one variation inside a `stable` feature as
`experimental`. Folding `content-focus` into `entity-item` accepted that gap knowingly rather than
inventing a new mechanism for it, and the gap is still there: nothing prevents an app from
importing `EntityItemContentFocusView` the way `x-stability` prevents importing an actually
`experimental`/`candidate` feature.

**Promoted to the generic track (ACC-2902 content-focus promotion).** `EntityItemContentFocusView`
was proved out in `apps/navigator-experimental` first (spec `002-pdf-viewer`) and is now mounted by
both apps' `$entity/$itemId.tsx` item routes — `apps/navigator`'s route mirrors
`apps/navigator-experimental`'s wiring (same `renderHomeLink`/`renderCollectionLink`/relation
callbacks); it no longer falls back to plain `EntityItemView` at the route level (the view itself
still does, per-item, for FR-001). There is no longer an "experimental-only" convention to enforce
here — both tracks may mount this view.

## Layering (spec-001 `feature-layer-imports.md`)

```
entity-item-view.tsx, attributes/, relations/
  -> @contentgrid/ui, @contentgrid/navigator-data

edit/  (edit-entity-item-view -> edit-entity-item-container -> edit-entity-item-form)
  -> ../../hal-forms (fields, field state), ../../problem-details, ../../unsaved-changes-guard
  -> @contentgrid/ui, @contentgrid/navigator-data

variations/content-focus/
  views/  (entity-item-content-focus-view.tsx)
    -> components/  (content-attribute-selector, content-preview-frame, content-preview-panel)
    -> util/  (select-default-content-attribute, pdfium-wasm-url)
    -> entity-item's own attributes/, relations/, entity-item-view.tsx — a sibling import
       within the same feature now, not a cross-feature one
    -> ../../../layout's `RightSidePanelLayout` (imported the same way as this feature's other
       layouts, `BreadCrumbsToolBarLayout`/`PageLayout`) — moved there from this variation's own
       components/ at the reviewer's request, since the layout itself carries no content-focus
       knowledge (round-2 review of #192: "since this layout is already very generic, could we
       move it to features/layout … so it can more easily be reused?")

  views, components -> @contentgrid/ui, @contentgrid/navigator-data
  util               -> @contentgrid/navigator-data only — no UI, no React components
```

- `variations/content-focus/views/entity-item-content-focus-view.tsx` takes only `entityName`,
  `itemId`, `toolbar?`, and relation callbacks (spec `contracts/content-focus-view.md`) — never a
  resolved `ProfileEntity` or `EntityItem` from its host (Principle VIII).
- `variations/content-focus/util/` stays pure: no `useQuery`, no JSX, no `@contentgrid/ui`
  import. Transformation logic (e.g. picking the default content attribute) lives here, not
  inline in a component.
- Data access goes through `@contentgrid/navigator-data` hooks only (`useContentPreview`,
  `useDownloadContent`, `useProfileEntity`, `useEntityItem`) — never a Layer-1 `@contentgrid/*`
  package directly.

## Deployment requirements (carries through to the app that mounts the content-focus variation)

- **CSP `worker-src blob:`** — the PDF engine (`@contentgrid/ui`'s `pdf-viewer` pattern) creates
  its PDFium worker as a `blob:` module worker (research.md §8.1/§8.2 of spec 002-pdf-viewer).
- **CSP `connect-src` must include the rendition service origin** whenever `renditionUri` is
  configured — non-PDF previews poll that origin via `contentFetch` (research.md §8.3).
- **No CDN**: the PDFium WASM binary is self-hosted (`util/pdfium-wasm-url.ts` imports it as a
  Vite-emitted hashed asset) — never loaded from jsDelivr or any other third-party host.
- **Rendition service CORS**: the rendition service must allow the Navigator origin, accept the
  same `Authorization` header used for content downloads (no separate frontend-side token
  exchange — TokenMonger handles whatever exchange the service needs on the platform side, per
  the FR-023 clarification in `specs/002-pdf-viewer/spec.md`), and **expose the `Location`
  response header** across origins (a plain CORS allow does not expose custom response headers
  by default — the initial `202` response's `Location` must be readable by `fetch()`/`contentFetch`
  or the poll step in `requestRendition` cannot find the job URL at all).
- **Liaison must deliver `v1.renditionUri`** in `config.js` alongside the existing OIDC fields —
  `useAppAuth()` reads it (with the dev-config override and the `VITE_RENDITION_URI` env fallback
  as the only other sources, per `packages/navigator-data/CLAUDE.md`'s "Content preview and
  renditions" section) to populate `NavigatorDataContextValue.renditionUri`. Renditions are
  silently disabled (`useContentPreview` reports `{ kind: "unavailable" }`, never an error) for
  any application Liaison has not been updated to serve this field for.
- **Open confirmations with the platform team, tracked in ACC-2960**: the rendition response
  contract (`202` + `Location` → poll → `200`/`invalid-conversion`/error) is reverse-engineered
  from the original Navigator, not yet documented by the platform; the CORS/`Authorization`/
  `Location`-exposure requirements above are the frontend's assumption pending that
  confirmation. Do not treat either as settled until ACC-2960 closes.
