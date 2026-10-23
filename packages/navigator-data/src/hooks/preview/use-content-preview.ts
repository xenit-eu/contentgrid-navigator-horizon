/**
 * Turns a content attribute into something displayable — the one hook the content preview
 * needs: PDF bytes (the stored PDF, or the platform's PDF rendition of a document), or the
 * stored image or video itself. See `contracts/content-preview-hooks.md` and `data-model.md`'s
 * "PreviewSource" (spec 002-pdf-viewer).
 *
 * Bytes and rendition requests both go through `contentFetch` — the same authenticated
 * binary client `useDownloadContent`/`useUploadContent` already use — never `apiFetch`. The
 * frontend performs no token exchange; see `preview/rendition-job.ts`'s doc comment.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { AttributeKind } from "../../accessors/entity-item";
import type { EntityItem, EntityItemAttributeContent } from "../../accessors/entity-item";
import type { ContentFetch } from "../../api/client";
import { isProblemWithStatus } from "../../api/problem-details/guards";
import { nativePreviewKind } from "../../preview/content-mimetype";
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
      /**
       * The content's own ETag (from the download response) — for a rendition, of the stored
       * file it was converted from — or null if absent.
       */
      readonly etag: string | null;
    }
  /** The stored image or video file, shown as it is (no rendition). */
  | {
      readonly kind: "image" | "video";
      readonly blob: Blob;
      /** The content's own ETag (from the download response), or null if absent. */
      readonly etag: string | null;
    }
  | { readonly kind: "noFile" }
  | { readonly kind: "unavailable"; readonly mimetype: string | null }
  | { readonly kind: "unsupported"; readonly mimetype: string | null };

export interface UseContentPreviewOptions {
  readonly enabled?: boolean;
}

const CONTENT_PREVIEW_GC_TIME_MS = 300_000;
const FALLBACK_FILENAME = "document.pdf";

/** A preview made from the stored file, so one that a 304 on the content's own ETag can keep. */
type StoredFilePreview = Extract<PreviewSource, { readonly etag: string | null }>;

/**
 * `previous` with its content ETag, when it shows the stored file the way `shownAs` does (the
 * stored PDF, image or video itself, or a rendition of it) — the only preview a 304 can keep.
 */
function revalidatablePreview(
  previous: PreviewSource | undefined,
  shownAs: "pdf" | "image" | "video" | "rendition",
): { readonly source: StoredFilePreview; readonly etag: string } | undefined {
  if (previous === undefined || !("etag" in previous) || previous.etag === null) {
    return undefined;
  }
  const previousShownAs =
    previous.kind === "pdf" && previous.origin === "rendition" ? "rendition" : previous.kind;
  return previousShownAs === shownAs ? { source: previous, etag: previous.etag } : undefined;
}

/**
 * Downloads the stored file, conditionally on `known`'s ETag when given: `known`'s preview while
 * the file still has that ETag (304), `noFile` when there is no file (404), else the response.
 */
async function downloadStoredFile(
  contentFetch: ContentFetch,
  entityItem: EntityItem,
  attributeName: string,
  known: { readonly source: StoredFilePreview; readonly etag: string } | undefined,
  signal: AbortSignal,
): Promise<{ readonly response: Response } | { readonly preview: PreviewSource }> {
  const request = entityItem.downloadContentRequest(attributeName, known?.etag ?? null);
  try {
    // No checkResponse call needed here: contentFetch already composes problemDetailsHook
    // (api/client.ts), which throws ProblemDetailError for any non-2xx response (a 304
    // included) before this ever resolves — see rendition-job.ts's fetchStep, which relies on
    // and documents the same behaviour.
    return { response: await contentFetch(new Request(request, { signal })) };
  } catch (error) {
    if (known !== undefined && isProblemWithStatus(error, 304)) {
      return { preview: known.source };
    }
    if (isProblemWithStatus(error, 404)) {
      return { preview: { kind: "noFile" } };
    }
    throw error;
  }
}

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
 * Resolves a content attribute to a displayable preview: the stored file directly when it is a
 * PDF, an image or a video, or — for any other file, when a rendition endpoint is configured —
 * the platform's PDF rendition of it.
 *
 * Key: `queryKeys.contentPreview.byUrl(link.href)` — no ETag: the entity item's ETag does not
 * change when only its file is replaced. Instead every fetch after the first is a conditional
 * download (`If-None-Match`) on the content's own ETag from the previous result: while the stored
 * file is unchanged (304), the previous preview is kept as it is — no download, no new rendition;
 * otherwise the new file is shown. `useUploadContent` invalidates the key after an upload.
 *
 * `queryFn` honours `signal` throughout — an unmount, a key change (new `entityItem`/
 * `attributeName`), or `options.enabled` flipping to `false` aborts any download or rendition
 * poll in flight (FR-021).
 *
 * `retry: false` (a failed download/rendition is not silently retried; the caller's Retry
 * action is `refetch()`), default `staleTime` (0 — a remount or the window regaining focus
 * revalidates, which is how a file replaced by someone else shows up), `gcTime: 300_000`
 * (5 minutes — long enough to survive a fullscreen toggle's unmount/remount without a
 * re-download, short enough not to hold bytes forever).
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
  const queryClient = useQueryClient();

  const contentAttribute = findContentAttribute(entityItem, attributeName);
  const { metadata, link } = contentAttribute;
  const queryKey = queryKeys.contentPreview.byUrl(link.href);

  return useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<PreviewSource> => {
      if (metadata === null) {
        return { kind: "noFile" };
      }

      // Each download is conditional on the ETag of the preview shown so far, so that preview
      // is kept while the stored file is unchanged.
      const previous = queryClient.getQueryData<PreviewSource>(queryKey);

      // A PDF, an image or a video is shown as it is stored.
      const previewKind = nativePreviewKind(metadata.mimetype);
      if (previewKind !== undefined) {
        const known = revalidatablePreview(previous, previewKind);
        const download = await downloadStoredFile(
          contentFetch,
          entityItem,
          attributeName,
          known,
          signal,
        );
        if ("preview" in download) {
          return download.preview;
        }
        const { response } = download;
        const etag = response.headers.get("ETag");
        if (previewKind === "pdf") {
          return {
            kind: "pdf",
            bytes: await response.arrayBuffer(),
            filename: metadata.filename ?? FALLBACK_FILENAME,
            origin: "stored",
            etag,
          };
        }
        return { kind: previewKind, blob: await response.blob(), etag };
      }

      // Any other file can only be shown through its PDF rendition.
      if (renditionUri === undefined || renditionPolling === undefined) {
        return { kind: "unavailable", mimetype: metadata.mimetype };
      }

      // The download only tells which version of the file is stored (the rendition service
      // fetches the file itself), so its body is cancelled unread — without waiting for that.
      const known = revalidatablePreview(previous, "rendition");
      const download = await downloadStoredFile(
        contentFetch,
        entityItem,
        attributeName,
        known,
        signal,
      );
      if ("preview" in download) {
        return download.preview;
      }
      const etag = download.response.headers.get("ETag");
      download.response.body?.cancel().catch(() => undefined);

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
        etag,
      };
    },
    enabled: options?.enabled,
    retry: false,
    gcTime: CONTENT_PREVIEW_GC_TIME_MS,
  });
}
