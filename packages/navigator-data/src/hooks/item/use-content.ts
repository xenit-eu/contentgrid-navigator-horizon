import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { checkResponse } from "@contentgrid/problem-details";
import { EntityItem } from "../../accessors/entity-item";
import { parseContentDisposition } from "../../api/content-types";
import { fetchHal, fetchVoid } from "../../api/hal-client";
import { queryKeys } from "../../query-keys";
import type { EntityItemShape } from "../../shapes";
import { useNavigatorData } from "../context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Variables for the `useUploadContent` mutation.
 */
export type UploadContentVariables = {
  /** The binary file to upload. */
  readonly file: Blob | File;
  /** Optional MIME type override. Defaults to `file.type` (when File) or `application/octet-stream`. */
  readonly contentType?: string;
  /** Optional filename override. Defaults to `file.name` (when File). */
  readonly filename?: string;
};

/**
 * Options for the `useUploadContent` hook.
 */
export interface UseUploadContentOptions {
  readonly mutationOptions?: Omit<
    UseMutationOptions<EntityItem, Error, UploadContentVariables>,
    "mutationFn"
  >;
}

/**
 * Result of a content download operation.
 */
export type ContentDownload = {
  /** The downloaded binary data. */
  readonly blob: Blob;
  /** MIME type from the Content-Type response header, or null if absent. */
  readonly mimetype: string | null;
  /** Filename from the Content-Disposition response header, or null if absent. */
  readonly filename: string | null;
  /** Content length in bytes from the Content-Length response header, or null if absent. */
  readonly contentLength: number | null;
  /** Whether this is a partial response (HTTP 206 Partial Content). */
  readonly isPartial: boolean;
};

/**
 * Variables for the `useDownloadContent` mutation.
 * Pass a `range` to request partial content (HTTP Range requests).
 */
export type DownloadContentVariables = {
  /** Byte range for partial download (Range: bytes=start-end). */
  readonly range?: { readonly start: number; readonly end?: number };
} | void;

/**
 * Options for the `useDownloadContent` hook.
 */
export interface UseDownloadContentOptions {
  readonly mutationOptions?: Omit<
    UseMutationOptions<ContentDownload, Error, DownloadContentVariables>,
    "mutationFn"
  >;
}

// ---------------------------------------------------------------------------
// useUploadContent
// ---------------------------------------------------------------------------

/**
 * Mutation hook for uploading binary content to a content attribute.
 *
 * Binary content operations are the ONE documented exception to the HAL-FORMS
 * template rule — they have no `_templates` entry. The `cg:content` link presence
 * is the ABAC gate. The Request is hand-built directly from the link href.
 *
 * Uses `contentFetch` (not `apiFetch`) — the binary client that omits the
 * `Accept: application/hal+json` header set by `createApiClient`.
 *
 * Attaches `If-Match` from the current ETag when available (included inside
 * `entityItem.uploadContentRequest`). On HTTP 412 (ETag mismatch), the error
 * surfaces as `ProblemDetailError` — the hook does NOT auto-retry.
 *
 * Cache behaviour on success:
 * - Re-fetches the entity item via `apiFetch` to get fresh metadata + new ETag.
 * - `setQueryData` on `entityItem.byUrl` with the fresh item.
 * - `invalidateQueries` on `entityItemCollection.forEntity`.
 * - Caller's `onSuccess` runs after cache is consistent.
 *
 * @param entityItem     - The entity item whose content attribute is being uploaded.
 * @param attributeName  - The name of the content attribute (must have a cg:content link).
 * @param options        - Optional mutation options (onSuccess, onError, etc.)
 * @returns TanStack mutation result; `data` is the updated `EntityItem` (re-fetched).
 */
export function useUploadContent(
  entityItem: EntityItem,
  attributeName: string,
  options?: UseUploadContentOptions,
) {
  const { apiFetch, contentFetch } = useNavigatorData();
  const queryClient = useQueryClient();
  const { profileEntity } = entityItem;

  const { onSuccess, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation({
    mutationFn: async ({ file, contentType, filename }: UploadContentVariables) => {
      // Hand-built Request: no HAL-FORMS template. URL only from the cg:content link.
      // uploadContentRequest() throws if the link is absent (ABAC deny).
      const req = entityItem.uploadContentRequest(attributeName, file, { contentType, filename });

      // PUT binary content — 204 No Content (discard body).
      await fetchVoid(contentFetch, req);

      // Re-fetch the entity item via apiFetch to get fresh metadata + new ETag.
      const { object, etag } = await fetchHal<EntityItemShape>(
        apiFetch,
        new Request(entityItem.selfLink.href),
      );
      return new EntityItem(object, profileEntity, etag);
    },
    onSuccess: async (item, variables, onMutateResult, context) => {
      // Populate item cache with fresh data + ETag.
      queryClient.setQueryData(queryKeys.entityItem.byUrl(profileEntity, item.selfLink.href), item);

      // Invalidate entity collections so lists reflect the change.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.entityItemCollection.forEntity(profileEntity),
      });

      // Compose caller's onSuccess LAST — after cache is consistent.
      await onSuccess?.(item, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });
}

// ---------------------------------------------------------------------------
// useDownloadContent
// ---------------------------------------------------------------------------

/**
 * Mutation hook for downloading binary content from a content attribute.
 *
 * Binary content operations are the ONE documented exception to the HAL-FORMS
 * template rule — they have no `_templates` entry. The `cg:content` link presence
 * is the ABAC gate. The Request is hand-built directly from the link href.
 *
 * Modeled as `useMutation` (imperative on user action — download button).
 * Blobs are NOT cached — each call to `mutate` fetches fresh bytes.
 *
 * Uses `contentFetch` (not `apiFetch`) — the binary client that omits the
 * `Accept: application/hal+json` header set by `createApiClient`.
 *
 * Pass `{ range: { start, end? } }` to request partial content (HTTP 206).
 * `isPartial` in the result is `true` when the response status is 206.
 *
 * @param entityItem     - The entity item whose content attribute is being downloaded.
 * @param attributeName  - The name of the content attribute (must have a cg:content link).
 * @param options        - Optional mutation options.
 * @returns TanStack mutation result; `data` is a `ContentDownload` with blob and metadata.
 */
export function useDownloadContent(
  entityItem: EntityItem,
  attributeName: string,
  options?: UseDownloadContentOptions,
) {
  const { contentFetch } = useNavigatorData();

  const { onSuccess, ...restMutationOptions } = options?.mutationOptions ?? {};

  return useMutation({
    mutationFn: async (variables: DownloadContentVariables) => {
      const range = variables && "range" in variables ? variables.range : undefined;

      // Hand-built Request: no HAL-FORMS template. URL only from the cg:content link.
      // downloadContentRequest() throws if the link is absent (ABAC deny).
      const req = entityItem.downloadContentRequest(attributeName, { range });

      // Execute request — checkResponse throws ProblemDetailError on non-2xx.
      const response = await contentFetch(req).then(checkResponse);

      const blob = await response.blob();

      const mimetypeHeader = response.headers.get("Content-Type");
      const mimetype = mimetypeHeader ? (mimetypeHeader.split(";")[0]?.trim() ?? null) : null;
      const filename = parseContentDisposition(response.headers.get("Content-Disposition"));
      const contentLengthHeader = response.headers.get("Content-Length");
      const contentLength =
        contentLengthHeader === null ? null : Number.parseInt(contentLengthHeader, 10);
      const isPartial = response.status === 206;

      return { blob, mimetype, filename, contentLength, isPartial } satisfies ContentDownload;
    },
    onSuccess: async (data, variables, onMutateResult, context) => {
      // No cache writes — blobs are not cached.
      await onSuccess?.(data, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });
}
