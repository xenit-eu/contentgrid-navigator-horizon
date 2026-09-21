import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** Optional MIME type override. Defaults to `file.type`, or `application/octet-stream` if empty. */
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
  /** Called with an integer 0–100 as upload bytes are sent. */
  readonly onProgress?: (percentage: number) => void;
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

/** Marks a rejection as an intentional cancel/unmount abort, not a real transport failure. */
class UploadCancelledError extends Error {}

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
 * hook chain as `contentFetch`, but XHR-backed so upload progress can be reported (see
 * `createContentUploadClient` in `src/api/client.ts`).
 *
 * No `If-Match` — matches the legacy Navigator; upload is an unconditional overwrite (see
 * `entityItem.uploadContentRequest`). Errors surface as `ProblemDetailError`; no auto-retry —
 * call `mutate` again with the same variables to retry.
 *
 * `progress` (0–100) is hook-local UI state, not server state. `cancel()` aborts the in-flight
 * request and resets the mutation to idle.
 *
 * Cache behaviour: on success, re-fetches the item for fresh metadata + ETag, `setQueryData`s
 * it, and invalidates the entity collection; caller's `onSuccess` runs last. On cancel/unmount/
 * error, invalidates instead (an aborted upload can't confirm the server didn't finish the write).
 *
 * @param entityItem     - The entity item whose content attribute is being uploaded.
 * @param attributeName  - The name of the content attribute (must have a cg:content link).
 * @param options        - Optional mutation options (onSuccess, onError, etc.) plus `onProgress`.
 * @returns TanStack mutation result plus `progress` (0–100) and `cancel()`;
 *          `data` is the updated `EntityItem` (re-fetched).
 */
export function useUploadContent(
  entityItem: EntityItem,
  attributeName: string,
  options?: UseUploadContentOptions,
) {
  const { apiFetch, createContentUploadFetch } = useNavigatorData();
  const queryClient = useQueryClient();
  const { profileEntity } = entityItem;

  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  // Controllers cancelled via `cancel()`/unmount, keyed by identity — lets a late-settling
  // rejection be attributed to the attempt that was actually cancelled, not whichever is current.
  const cancelledControllersRef = useRef<WeakSet<AbortController>>(new WeakSet());

  // Stable dispatcher so the memoized upload client doesn't need rebuilding per render.
  const onProgressRef = useRef(options?.onProgress);
  onProgressRef.current = options?.onProgress;

  // Read via a ref so the unmount effect below stays mount/unmount-only, not re-running (and
  // aborting a real upload) on every entityItem identity change.
  const invalidateEntityItemRef = useRef<() => void>(() => {});

  const uploadFetch = useMemo(() => {
    if (!createContentUploadFetch) {
      throw new Error(
        "useUploadContent requires NavigatorDataProvider's createContentUploadFetch prop — " +
          "pass one built from createContentUploadClient (see src/api/client.ts).",
      );
    }
    return createContentUploadFetch((pct) => {
      setProgress(pct);
      onProgressRef.current?.(pct);
    });
  }, [createContentUploadFetch]);

  const { onSuccess, onError, ...restMutationOptions } = options?.mutationOptions ?? {};

  // Shared by `cancel()` and `onError` below — an aborted/failed upload can't confirm whether the
  // server finished the write, so invalidate rather than trust the last-known metadata.
  const invalidateEntityItem = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.entityItem.byUrl(profileEntity, entityItem.selfLink.href),
      }),
    [queryClient, profileEntity, entityItem],
  );
  invalidateEntityItemRef.current = invalidateEntityItem;

  const mutation = useMutation({
    mutationFn: async ({ file, contentType, filename }: UploadContentVariables) => {
      setProgress(0);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Hand-built Request: no HAL-FORMS template. URL only from the cg:content link.
        // uploadContentRequest() throws if the link is absent (ABAC deny).
        const req = entityItem.uploadContentRequest(attributeName, file, {
          contentType,
          filename,
          signal: controller.signal,
        });

        // PUT binary content via the progress-reporting XHR client — 204 No Content (discard body).
        await fetchVoid(uploadFetch, req);

        // Re-fetch the entity item via apiFetch to get fresh metadata + new ETag.
        const { object, etag } = await fetchHal<EntityItemShape>(
          apiFetch,
          new Request(entityItem.selfLink.href),
        );
        return new EntityItem(object, profileEntity, etag);
      } catch (error) {
        throw cancelledControllersRef.current.has(controller) ? new UploadCancelledError() : error;
      } finally {
        // Only clear if still this attempt's controller — don't clear a newer attempt's.
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        cancelledControllersRef.current.delete(controller);
      }
    },
    onSuccess: async (item, variables, onMutateResult, context) => {
      setProgress(100);

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
      // cancel() already reset progress/UI to idle — don't resurrect this as a visible failure,
      // and don't zero out `progress` out from under a newer attempt that's since started.
      if (error instanceof UploadCancelledError) {
        return;
      }

      setProgress(0);
      await invalidateEntityItem();

      // 415, network failures, etc. must still surface to the caller — never swallowed.
      await onError?.(error, variables, onMutateResult, context);
    },
    ...restMutationOptions,
  });

  // Abort an in-flight upload on unmount — otherwise the XHR keeps running against a gone
  // component. Also invalidate, same reasoning as `cancel()` below.
  useEffect(
    () => () => {
      if (abortRef.current) {
        cancelledControllersRef.current.add(abortRef.current);
        abortRef.current.abort();
        invalidateEntityItemRef.current();
      }
    },
    [],
  );

  const { reset } = mutation;
  const cancel = useCallback(() => {
    if (abortRef.current) {
      cancelledControllersRef.current.add(abortRef.current);
      abortRef.current.abort();
      abortRef.current = null;
    }
    setProgress(0);
    reset();
    invalidateEntityItem();
  }, [reset, invalidateEntityItem]);

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
