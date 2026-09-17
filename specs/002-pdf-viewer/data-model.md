# Data Model: PDF Viewer for Content Attributes

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

This feature persists nothing. The model describes runtime state in the browser and the shapes that
cross package boundaries. Platform entities (`ProfileEntity`, `ProfileAttribute`, `EntityItem`,
`ContentMetadata`) are the existing `@contentgrid/navigator-data` accessors and are not redefined.

## Content attribute (existing)

**Source**: `ProfileAttribute` with `isContent === true`; on an item, `EntityItemAttributeContent`
`{ name, metadata: ContentMetadata | null, link }` where `ContentMetadata = { filename, mimetype, length }`.

**Rules**

- Layout selection (FR-001): `profileEntity.hasContentAttributes` (existing getter, `accessors/entity-profile.ts`).
- Default selection (FR-004): first content attribute in profile order whose `metadata !== null`;
  if none holds a file, the first content attribute (its panel shows the "No file" state).
- A file exists iff `metadata !== null`; a 404 from the link is treated identically.

## PreviewSource (new, `navigator-data`)

Discriminated union returned by `useContentPreview` as query data.

| Variant       | Fields                                                                      | Meaning                                                                     |
| ------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `pdf`         | `bytes: ArrayBuffer`, `filename: string`, `origin: "stored" \| "rendition"` | Displayable PDF; `origin` drives the "converted preview" indicator (FR-020) |
| `noFile`      | —                                                                           | Attribute holds no file (metadata `null` or link answered 404)              |
| `unavailable` | `mimetype: string \| null`                                                  | Non-PDF and no rendition endpoint configured (FR-022)                       |
| `unsupported` | `mimetype: string \| null`                                                  | Rendition service reported `invalid-conversion` (FR-018)                    |

Failures are not variants: they reject the query with `ProblemDetailError`, `RenditionTimeoutError`,
`RenditionProtocolError` or a plain `Error`, surfaced by TanStack Query as `error`.

**Validation**

- `bytes.byteLength > 0`; the viewer decides whether the bytes are a valid or protected PDF.
- `filename` falls back to `metadata.filename`, then `"document.pdf"` for renditions.

**Query key**: `queryKeys.contentPreview.byUrl(link.href, entityItem.etag)` — own root
`["ContentPreview", href, etag]`. The ETag makes a re-upload a new key. Never invalidated by relation
or item mutations; `gcTime` 5 min, `staleTime` Infinity.

## RenditionJob (new, `navigator-data/preview/rendition-job.ts`)

Internal state machine of `requestRendition(fetch, uriTemplate, contentHref, options)`.

```text
requested ──202 + Location──▶ pending ──200──▶ ready(bytes)
    │                            │   └─202──▶ pending (after intervalMs; abort → cancelled)
    │                            ├─ invalid-conversion problem ──▶ unsupported
    │                            ├─ other non-2xx / network ──▶ failed(problem | Error)
    │                            └─ now ≥ deadline ──▶ timedOut
    ├─ 200 directly ──▶ ready(bytes)            (service may answer immediately)
    ├─ invalid-conversion problem ──▶ unsupported
    └─ other non-2xx / missing Location ──▶ failed(RenditionProtocolError)
```

**Fields**: `uriTemplate` (from config, `{?url}` expanded with the content href as an opaque value),
`intervalMs` (default 2000), `timeoutMs` (default 60000), `signal` (from the query), `jobUrl`
(from `Location`), `deadline`.

**Rules**

- Poll first, then wait: a ready job is never delayed by a sleep.
- Every request goes through `contentFetch` (the user's credentials; any exchange happens on the platform side). The content href is passed only as
  the `url` parameter value; nothing else is built.
- `cancelled` (abort) rejects with `AbortError` and is not shown as an error.

## Viewer state (new, `@contentgrid/ui` pattern, component-local)

| Field           | Type                                                             | Notes                                                                  |
| --------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `documentState` | `idle \| opening \| ready \| protected \| invalid`               | From document-manager events; `protected` = password required (FR-024) |
| `page`          | `{ current: number; total: number }`                             | 1-based for display; updated on scroll; controls enabled when `ready`  |
| `zoom`          | `{ mode: "fit-width" \| "fit-page" \| "custom"; level: number }` | Presets 25–400 %; mode survives fullscreen (FR-009)                    |
| `search`        | `{ query; total; activeIndex; matchCase; wholeWord; open }`      | FR-014                                                                 |
| `fullscreen`    | `boolean`                                                        | Native Fullscreen API on the host element (FR-011)                     |

Transitions: `idle → opening → ready | protected | invalid`; `ready → idle` when `bytes` changes
(document closed with the leak guard, see research §8.1).

## Content preview panel state (new, feature component)

Derived, not stored: `query.status × PreviewSource` → one of the FR-024 states.

| Preview state        | Condition                                                        | Download | Retry |
| -------------------- | ---------------------------------------------------------------- | -------- | ----- |
| `noFile`             | `metadata === null` or `PreviewSource.noFile`                    | no       | no    |
| `loading`            | query pending, expected `origin: stored`                         | yes      | no    |
| `preparingPreview`   | query pending, non-PDF with rendition configured (FR-006/FR-012) | yes      | no    |
| `ready`              | `PreviewSource.pdf`                                              | yes      | no    |
| `previewUnavailable` | `unavailable` or `unsupported`                                   | yes      | no    |
| `couldNotPrepare`    | `RenditionTimeoutError` or rendition failure                     | yes      | yes   |
| `couldNotRetrieve`   | download failure (`ProblemDetailError` other than 404)           | yes      | yes   |
| `cannotDisplay`      | viewer reports `invalid`                                         | yes      | no    |
| `protected`          | viewer reports `protected`                                       | yes      | no    |
| `viewerFailure`      | error boundary caught a viewer exception (FR-025)                | yes      | yes   |

Changing `attributeName` or `entityItem` resets to the new key's state; nothing from the previous key is
displayed (FR-006).

## Configuration (extended, `RuntimeAppConfig`)

| Field                     | Type    | Source                                                                    | Default                              |
| ------------------------- | ------- | ------------------------------------------------------------------------- | ------------------------------------ |
| `renditionUri`            | string? | Liaison `config.js` `v1.renditionUri`, dev override, `VITE_RENDITION_URI` | unset → renditions disabled (FR-022) |
| `renditionPollIntervalMs` | number? | Liaison / dev override                                                    | 2000                                 |
| `renditionTimeoutMs`      | number? | Liaison / dev override                                                    | 60000                                |

Validation: `renditionUri` must contain the `{?url}` expression; interval ≥ 250 ms; timeout ≥ interval.
