/**
 * Turns a content attribute into displayable PDF bytes — the one hook the PDF viewer
 * feature needs, regardless of whether the stored file already is a PDF or must first go
 * through the platform's rendition service. See `contracts/content-preview-hooks.md` and
 * `data-model.md`'s "PreviewSource" (spec 002-pdf-viewer).
 *
 * Bytes and rendition requests both go through `contentFetch` — the same authenticated
 * binary client `useDownloadContent`/`useUploadContent` already use — never `apiFetch`. The
 * frontend performs no token exchange; see `preview/rendition-job.ts`'s doc comment.
 */
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { AttributeKind } from "../../accessors/entity-item";
import type { EntityItem, EntityItemAttributeContent } from "../../accessors/entity-item";
import { isProblemWithStatus } from "../../api/problem-details/guards";
import { isPdfMimetype } from "../../preview/content-mimetype";
import { requestRendition } from "../../preview/rendition-job";
import { queryKeys } from "../../query-keys";
import { useNavigatorData } from "../context";

/**
 * Discriminated union of everything `useContentPreview` can resolve to. Failures (a
 * download/rendition error, a rendition timeout, an abort) are NOT variants — they reject
 * the query as `Error` (typically `ProblemDetailError` or `RenditionTimeoutError`), surfaced
 * by TanStack Query as `error`.
 */
export type PreviewSource =
  | {
      readonly kind: "pdf";
      readonly bytes: ArrayBuffer;
      /**
       * Display-only (e.g. a viewer title bar) — NOT the name to save a download under.
       * For `origin: "rendition"` this is the *original* file's name (e.g. `report.docx`)
       * even though `bytes` is the converted PDF. Download uses `useDownloadContent`
       * (`hooks/item/use-content.ts`) against the stored file directly, independent of
       * this hook, so the mismatch never reaches a save dialog.
       */
      readonly filename: string;
      /** Drives the "converted preview" indicator (FR-020) — never inferred from mimetype. */
      readonly origin: "stored" | "rendition";
    }
  | { readonly kind: "noFile" }
  | { readonly kind: "unavailable"; readonly mimetype: string | null }
  | { readonly kind: "unsupported"; readonly mimetype: string | null };

export interface UseContentPreviewOptions {
  readonly enabled?: boolean;
}

const CONTENT_PREVIEW_GC_TIME_MS = 300_000;
const FALLBACK_FILENAME = "document.pdf";

/**
 * Resolves `attributeName` to its `EntityItemAttributeContent` on `entityItem`.
 *
 * @throws {Error} synchronously when `attributeName` does not name a content attribute of
 *   this item — a caller programming error (wrong attribute name, or an attribute that
 *   isn't `isContent`), not a runtime state the hook should render around.
 */
function findContentAttribute(
  entityItem: EntityItem,
  attributeName: string,
): EntityItemAttributeContent {
  const attribute = entityItem.findAttribute(attributeName);
  if (attribute === undefined || attribute.value.kind !== AttributeKind.CONTENT) {
    throw new Error(
      `'${attributeName}' is not a content attribute on entity '${entityItem.profileEntity.name}'`,
    );
  }
  return attribute.value;
}

/**
 * Resolves a content attribute to displayable PDF bytes: the stored file directly when it
 * is already a PDF, or — when a non-PDF file is stored and a rendition endpoint is
 * configured — the platform's PDF rendition of it.
 *
 * Key: `queryKeys.contentPreview.byUrl(link.href, entityItem.etag)`. The ETag makes a
 * re-upload onto the same attribute produce a new key automatically, so a stale preview
 * is never served after a re-upload. Never invalidated by an item/collection mutation.
 *
 * `queryFn` honours `signal` throughout — an unmount, a key change (new `entityItem`/
 * `attributeName`/ETag), or `options.enabled` flipping to `false` aborts any download or
 * rendition poll in flight (FR-021).
 *
 * `retry: false` (a failed download/rendition is not silently retried; the caller's Retry
 * action is `refetch()`), `staleTime: Infinity` (a specific ETag's content never goes
 * stale on its own), `gcTime: 300_000` (5 minutes — long enough to survive a fullscreen
 * toggle's unmount/remount without a re-download, short enough not to hold bytes forever).
 *
 * Pass an individually-fetched `entityItem` (e.g. from `useEntityItem`), not one taken
 * straight from a collection page: `EntityItemCollection` items carry `etag: null` (the
 * collection response has no per-item ETag), so the key would degrade to
 * `["ContentPreview", href, null]` — with `staleTime: Infinity`, a re-upload done elsewhere
 * would not be detected under that key until the item itself is re-fetched with a real ETag.
 *
 * @param entityItem - The item whose content attribute is being previewed.
 * @param attributeName - Name of a content attribute on `entityItem` (see
 *   {@link findContentAttribute} for the synchronous-throw contract).
 * @param options - `enabled` to pause the query (e.g. while a parent panel isn't visible).
 */
export function useContentPreview(
  entityItem: EntityItem,
  attributeName: string,
  options?: UseContentPreviewOptions,
): UseQueryResult<PreviewSource, Error> {
  const { contentFetch, renditionUri, renditionPolling } = useNavigatorData();

  const contentAttribute = findContentAttribute(entityItem, attributeName);
  const { metadata, link } = contentAttribute;

  return useQuery({
    queryKey: queryKeys.contentPreview.byUrl(link.href, entityItem.etag),
    queryFn: async ({ signal }): Promise<PreviewSource> => {
      if (metadata === null) {
        return { kind: "noFile" };
      }

      if (isPdfMimetype(metadata.mimetype)) {
        const request = entityItem.downloadContentRequest(attributeName);
        try {
          // No checkResponse call needed here: contentFetch already composes
          // problemDetailsHook (api/client.ts), which throws ProblemDetailError for any
          // non-2xx response before this ever resolves — see rendition-job.ts's fetchStep,
          // which relies on and documents the same behaviour.
          const response = await contentFetch(new Request(request, { signal }));
          const bytes = await response.arrayBuffer();
          return {
            kind: "pdf",
            bytes,
            filename: metadata.filename ?? FALLBACK_FILENAME,
            origin: "stored",
          };
        } catch (error) {
          if (isProblemWithStatus(error, 404)) {
            return { kind: "noFile" };
          }
          throw error;
        }
      }

      // Non-PDF from here on (isPdfMimetype/needsRendition are exact complements).
      if (renditionUri === undefined || renditionPolling === undefined) {
        return { kind: "unavailable", mimetype: metadata.mimetype };
      }

      const rendition = await requestRendition(contentFetch, renditionUri, link.href, {
        signal,
        intervalMs: renditionPolling.intervalMs,
        timeoutMs: renditionPolling.timeoutMs,
      });

      if (rendition.kind === "unsupported") {
        return { kind: "unsupported", mimetype: metadata.mimetype };
      }

      return {
        kind: "pdf",
        bytes: rendition.bytes,
        filename: metadata.filename ?? FALLBACK_FILENAME,
        origin: "rendition",
      };
    },
    enabled: options?.enabled,
    retry: false,
    staleTime: Infinity,
    gcTime: CONTENT_PREVIEW_GC_TIME_MS,
  });
}
