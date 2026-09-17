# Contract: Content preview data layer (`@contentgrid/navigator-data`)

## `useContentPreview(entityItem, attributeName, options?)`

```ts
export type PreviewSource =
  | { kind: "pdf"; bytes: ArrayBuffer; filename: string; origin: "stored" | "rendition" }
  | { kind: "noFile" }
  | { kind: "unavailable"; mimetype: string | null }
  | { kind: "unsupported"; mimetype: string | null };

export interface UseContentPreviewOptions {
  readonly enabled?: boolean;
}

export function useContentPreview(
  entityItem: EntityItem,
  attributeName: string,
  options?: UseContentPreviewOptions,
): UseQueryResult<PreviewSource, Error>;
```

- Takes the domain object, not an href. Throws (synchronously) if `attributeName` is not a content
  attribute of the item.
- Key: `queryKeys.contentPreview.byUrl(contentHref, entityItem.etag)`.
- `queryFn` honours `signal`; unmount or key change aborts any download or poll in flight.
- `retry: false`, `staleTime: Infinity`, `gcTime: 300_000`. Retry is `refetch()`.
- Uses `contentFetch` for both stored PDFs and rendition requests (the user's credentials; TokenMonger handles any exchange on the platform side); never `apiFetch`.
- Never writes to other query keys; never invalidates item or collection caches.

## `requestRendition(fetch, uriTemplate, contentHref, options)`

```ts
export interface RequestRenditionOptions {
  readonly signal: AbortSignal;
  readonly intervalMs: number; // default 2000
  readonly timeoutMs: number; // default 60000
}
export type RenditionResult = { kind: "ready"; bytes: ArrayBuffer } | { kind: "unsupported" };
export class RenditionTimeoutError extends Error {}
export class RenditionProtocolError extends Error {} // no Location, unexpected status
export function requestRendition(
  fetch: TypedFetch,
  uriTemplate: string,
  contentHref: string,
  options: RequestRenditionOptions,
): Promise<RenditionResult>;
```

Pure protocol function; no React. See [rendition-service.md](rendition-service.md).

## Context and config

```ts
export interface NavigatorDataContextValue {
  apiFetch: TypedFetch;
  contentFetch: TypedFetch;
  profileUrl: string;
  renditionUri?: string; // URI template with {?url}
  renditionPolling?: { intervalMs: number; timeoutMs: number };
}
```

`RuntimeAppConfig` gains `renditionPollIntervalMs?`, `renditionTimeoutMs?`; `ContentGridConfigSchema` accepts `v1.renditionUri`. `makeWrapper(queryClient?, apiFetch?, contentFetch?, renditionUri?)`
in `hooks/test-utils.tsx` gains matching optional parameters.

## Utilities

```ts
export function isPdfMimetype(mimetype: string | null | undefined): boolean; // "application/pdf; charset=binary" → true, case-insensitive
export function needsRendition(mimetype: string | null | undefined): boolean; // !isPdfMimetype; missing/generic → true
export const RENDITION_INVALID_CONVERSION =
  "https://contentgrid.cloud/problems/renditions/invalid-conversion";
```

## Query key

```ts
contentPreview: {
  byUrl: (href: string, etag: string | null) => ["ContentPreview", href, etag] as const,
}
```

## Tests (MSW)

- `createRenditionHandlers({ requestUrl, jobUrl, pendingPolls, outcome: "ready" | "invalid-conversion" | "error" | "never" })` in `test-fixtures/msw/handlers.ts`.
- Bodies are `Uint8Array`; PDF fixtures from `test-fixtures/pdf/`.
