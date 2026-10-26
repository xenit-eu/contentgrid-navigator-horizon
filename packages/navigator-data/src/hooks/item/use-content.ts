import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { checkResponse } from "@contentgrid/problem-details";
import { EntityItem } from "../../accessors/entity-item";
import { parseContentDisposition } from "../../api/content-types";
import { fetchHal, fetchVoid } from "../../api/hal-client";
import { isProblemWithStatus } from "../../api/problem-details/guards";
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
  /** The file to upload. */
  readonly file: File;
  /**
   * The ETag of the stored content (e.g. `ContentDownload.etag`), or null when the attribute holds
   * no file. Never the entity item's ETag — content is its own conditional-request resource.
   */
  readonly contentEtag: string | null;
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
  /** The content's own ETag (for a conditional upload), or null if absent. */
  readonly etag: string | null;
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
 * Sends through `contentFetch.withUploadProgress` (not `apiFetch`) — the binary client that
 * omits the `Accept: application/hal+json` header set by `createApiClient`, over XHR so the
 * returned `progress` (0–100) follows the upload.
 *
 * `entityItem.uploadContentRequest` makes the PUT conditional on `contentEtag`: `If-Match` when
 * given, `If-None-Match: *` when null. On HTTP 412 (the stored file changed in the meantime), the
 * error surfaces as `ProblemDetailError` and the item query is invalidated so the newer version
 * loads — the hook does NOT auto-retry.
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
 * @returns TanStack mutation result; `data` is the updated `EntityItem` (re-fetched). Also
 *          `progress`: the percentage of the file sent by the latest upload.
 */
export function useUploadContent(
  entityItem: EntityItem,
  attributeName: string,
  options?: UseUploadContentOptions,
) {
  const { apiFetch, contentFetch } = useNavigatorData();
  const queryClient = useQueryClient();
  const { profileEntity } = entityItem;

  const { onSuccess, onError, ...restMutationOptions } = options?.mutationOptions ?? {};
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async ({ file, contentEtag }: UploadContentVariables) => {
      setProgress(0);
      // Hand-built Request: no HAL-FORMS template. URL only from the cg:content link.
      // uploadContentRequest() throws if the link is absent (ABAC deny).
      const req = entityItem.uploadContentRequest(attributeName, file, contentEtag);

      // Send the file, updating `progress` as it goes. The server answers 204 No Content.
      await fetchVoid(contentFetch.withUploadProgress(setProgress), req);

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
    onError: async (error, variables, onMutateResult, context) => {
      // The stored file changed first: reload the item so it shows the current file.
      if (isProblemWithStatus(error, 412)) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.entityItem.byUrl(profileEntity, entityItem.selfLink.href),
        });
      }
      await onError?.(error, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });

  return { ...mutation, progress };
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
      const etag = response.headers.get("ETag");

      return {
        blob,
        mimetype,
        filename,
        contentLength,
        isPartial,
        etag,
      } satisfies ContentDownload;
    },
    onSuccess: async (data, variables, onMutateResult, context) => {
      // No cache writes — blobs are not cached.
      await onSuccess?.(data, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });
}
