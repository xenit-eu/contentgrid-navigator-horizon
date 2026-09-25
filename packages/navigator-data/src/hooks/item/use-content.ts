import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { checkResponse } from "@contentgrid/problem-details";
import type { EntityItem } from "../../accessors/entity-item";
import { parseContentDisposition } from "../../api/content-types";
import { fetchVoid } from "../../api/hal-client";
import { queryKeys } from "../../query-keys";
import { useNavigatorData } from "../context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Variables for the `useUploadContent` mutation.
 */
export type UploadContentVariables = {
  /** The file to upload. Sent under its own `name`. */
  readonly file: File;
};

/**
 * Options for the `useUploadContent` hook.
 */
export interface UseUploadContentOptions {
  readonly mutationOptions?: Omit<
    UseMutationOptions<void, Error, UploadContentVariables>,
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
 * Binary content has no `_templates` entry — the ONE documented exception to the HAL-FORMS
 * template rule. The `cg:content` link presence is the ABAC gate; the Request is hand-built
 * from the link href.
 *
 * Uses `createContentUploadFetch`, not `apiFetch`/`contentFetch` — same auth + problem-details
 * hook chain as `contentFetch`, but XHR-backed so upload progress can be reported.
 *
 * No `If-Match` — upload is an unconditional overwrite. Errors
 * surface as `ProblemDetailError`; no auto-retry — call `mutate(variables)` again to retry.
 *
 * `progress` (0–100) is hook-local UI state. `cancel()` aborts the in-flight request and resets
 * the mutation to idle; an aborted upload never reaches the caller's `onError`. Unmounting does
 * not abort — the upload finishes and still invalidates the item.
 *
 * Cache behaviour: the PUT returns 204, so the item is invalidated
 * rather than written. On success the item and its entity collections are invalidated (and
 * awaited) before the caller's `onSuccess`; on failure or abort the item is invalidated, since
 * the write may still have landed.
 *
 * @param entityItem     - The entity item whose content attribute is being uploaded.
 * @param attributeName  - The name of the content attribute (must have a cg:content link).
 * @param options        - Optional mutation options (onSuccess, onError, etc.).
 * @returns TanStack mutation result plus `progress` (0–100) and `cancel()`.
 */
export function useUploadContent(
  entityItem: EntityItem,
  attributeName: string,
  options?: UseUploadContentOptions,
) {
  const { createContentUploadFetch } = useNavigatorData();
  const queryClient = useQueryClient();
  const { profileEntity } = entityItem;

  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const uploadFetch = useMemo(
    () => createContentUploadFetch(setProgress),
    [createContentUploadFetch],
  );

  const { onSuccess, onError, ...restMutationOptions } = options?.mutationOptions ?? {};

  const invalidateEntityItem = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.entityItem.byUrl(profileEntity, entityItem.selfLink.href),
    });

  const mutation = useMutation({
    mutationFn: async ({ file }: UploadContentVariables) => {
      setProgress(0);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // uploadContentRequest() throws if the cg:content link is absent (ABAC deny).
        const req = entityItem.uploadContentRequest(attributeName, file, {
          signal: controller.signal,
        });
        await fetchVoid(uploadFetch, req);
      } finally {
        // Only clear if still this attempt's controller — don't clear a newer attempt's.
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    onSuccess: async (data, variables, onMutateResult, context) => {
      await Promise.all([
        invalidateEntityItem(),
        queryClient.invalidateQueries({
          queryKey: queryKeys.entityItemCollection.forEntity(profileEntity),
        }),
      ]);

      // Compose caller's onSuccess LAST — after the cache has re-fetched.
      await onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: async (error, variables, onMutateResult, context) => {
      await invalidateEntityItem();

      // Only cancel() aborts, and a cancel is not a failure to report.
      if (error.name === "AbortError") {
        return;
      }

      await onError?.(error, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });

  const { reset } = mutation;
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    reset();
  }, [reset]);

  return { ...mutation, progress, cancel };
}

// ---------------------------------------------------------------------------
// useDownloadContent
// ---------------------------------------------------------------------------

/**
 * Mutation hook for downloading binary content from a content attribute.
 *
 * Same binary-content exception as `useUploadContent` — no `_templates`, `cg:content` link
 * presence is the ABAC gate, Request hand-built from the link href.
 *
 * Modeled as `useMutation` (imperative on user action, e.g. a download button). Blobs are NOT
 * cached — each `mutate` call fetches fresh bytes. Uses `contentFetch`, not `apiFetch` — omits
 * the `Accept: application/hal+json` header.
 *
 * Pass `{ range: { start, end? } }` for partial content (HTTP 206); `isPartial` reflects that.
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
