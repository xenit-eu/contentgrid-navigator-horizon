# packages/features/src/entity-item-content-focus — CLAUDE.md

Feature: `entity-item-content-focus` · `x-stability: "experimental"` (spec `002-pdf-viewer`)

## Scope

Renders an entity item's content attribute (a PDF, or a non-PDF previewed through the
platform's PDF rendition service) next to its attributes and relations, with the production
viewer toolbar. Mounted only by `apps/navigator-experimental` — never by `apps/navigator`
(generic track) while `x-stability` stays `experimental` (ADR-006, root `CLAUDE.md`).

This feature exists as a separate directory, rather than a change to the stable `entity-item`
feature, only because a `stable` feature may not import `experimental`/`candidate` code
(`packages/features/CLAUDE.md` forbidden imports). It reuses `entity-item`'s
`EntityItemAttributes`, `RelationToOneSection`, and `RelationToManySection` — the allowed
direction (experimental → stable).

## Layering (spec-001 `feature-layer-imports.md`)

```
views/  (entity-item-content-focus-view.tsx)
  -> components/  (content-focus-layout, content-attribute-selector,
                    content-preview-frame, content-preview-panel)
  -> util/  (select-default-content-attribute, pdfium-wasm-url)

views, components -> @contentgrid/ui, @contentgrid/navigator-data, entity-item (stable)
util               -> @contentgrid/navigator-data only — no UI, no React components
```

- `views/entity-item-content-focus-view.tsx` takes only `entityName`, `itemId`, `toolbar?`, and
  relation callbacks (spec `contracts/content-focus-view.md`) — never a resolved `ProfileEntity`
  or `EntityItem` from its host (Principle VIII).
- `util/` stays pure: no `useQuery`, no JSX, no `@contentgrid/ui` import. Transformation logic
  (e.g. picking the default content attribute) lives here, not inline in a component.
- Data access goes through `@contentgrid/navigator-data` hooks only
  (`useContentPreview`, `useDownloadContent`, `useProfileEntity`, `useEntityItem`) — never a
  Layer-1 `@contentgrid/*` package directly.

## Deployment requirements (carries through to the app that mounts this feature)

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

## Promotion path (`experimental` → folded into `entity-item`)

Promotion here is not the usual flag flip (`packages/features/CLAUDE.md`) — the plan
(`specs/002-pdf-viewer/plan.md` §8.5, `research.md` §8.5) records a stronger target: this
feature is a temporary wrapper, removed once promoted.

1. Move the FR-001 branch (`profileEntity.hasContentAttributes` ? content-focus layout :
   attribute-focus body) from `entity-item-content-focus-view.tsx` into `entity-item`'s
   `EntityItemView`.
2. Move `ContentPreviewPanel`, `ContentPreviewFrame`, `ContentAttributeSelector`, and
   `ContentFocusLayout` into `entity-item` alongside the existing attributes/relations
   components they compose with.
3. Flip `apps/navigator-experimental`'s (and, once ready for the generic track,
   `apps/navigator`'s) route to mount `entity-item`'s `EntityItemView` directly — no route needs
   to keep pointing at this wrapper.
4. Delete this directory (`packages/features/src/entity-item-content-focus/`) — no fork drift,
   per `packages/features/CLAUDE.md`.
5. Confirm every dependency of the moved code is at or above `entity-item`'s stability tier
   before flipping anything to `stable` (`@contentgrid/ui`'s `pdf-viewer` pattern has no
   `x-stability` of its own — packages/ui patterns are not gated by the three-track model — so
   this check concerns only feature-to-feature dependencies).

Do not promote by flipping this directory's own `x-stability` field — the whole point of the
wrapper is that it disappears on promotion, per the plan's explicit alternative-rejected
rationale (a `pdf-preview` feature holding the viewer would need a features→features import from
the create flow; modifying `entity-item` directly would regress its stability).
