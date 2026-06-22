import { HalObject, HalSlice } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { checkResponse } from "@contentgrid/problem-details";
import type { TypedFetch } from "./client";

export { resolveTemplate, resolveTemplateRequired } from "@contentgrid/hal-forms";

/**
 * Returns a new Request with the `If-Match` header set to the given ETag value.
 *
 * When `etag` is `null`, the original request is returned unchanged (no header added).
 * The ETag value is sent verbatim — do NOT strip surrounding quotes.
 * See packages/navigator-data/CLAUDE.md — ETag / conditional-request pattern.
 */
export function addIfMatchHeader(request: Request, etag: string | null): Request {
  if (etag === null) {
    return request;
  }
  return new Request(request, {
    headers: { ...Object.fromEntries(request.headers), "If-Match": etag },
  });
}

/**
 * Fetches a resource and discards the response body (for 204 No Content responses).
 *
 * Throws a `ProblemDetailError` on non-2xx responses.
 * Used by delete, relation, and content mutation hooks.
 */
export async function fetchVoid(apiFetch: TypedFetch, request: Request): Promise<void> {
  await apiFetch(request).then(checkResponse);
}

/**
 * Result of a single-resource HAL fetch.
 * The ETag is returned verbatim (including surrounding quotes) and must be
 * passed as If-Match on any subsequent PUT/PATCH to the same URL.
 * See packages/navigator-data/CLAUDE.md — ETag / conditional-request pattern.
 */
export interface HalFetchResult<T> {
  object: HalObject<T>;
  /** ETag response header value, or null when the server did not send one. */
  etag: string | null;
}

export async function fetchHal<T = Record<string, unknown>>(
  apiFetch: TypedFetch,
  request: Request,
): Promise<HalFetchResult<T>> {
  const response = await apiFetch(request).then(checkResponse);
  const etag = response.headers.get("ETag");
  const json = await response.json();
  return {
    object: new HalObject<T>(json as HalObjectShape<T>),
    etag,
  };
}

export async function fetchHalSlice<T = Record<string, unknown>>(
  apiFetch: TypedFetch,
  request: Request,
): Promise<HalSlice<T>> {
  const { object } = await fetchHal(apiFetch, request);
  return HalSlice.from<T>(object);
}

/**
 * Fetch a single HAL resource, check for errors, and return the parsed HalObject.
 *
 * Unlike `fetchHal`, this calls `checkResponse` so error responses throw a
 * `ProblemDetailsError` instead of silently parsing as a HalObject.
 * Use this for mutation responses (create, update) where error handling is required.
 * Use `fetchHal` when you also need the ETag header (item detail fetches).
 */
export async function fetchHalObject<T = Record<string, unknown>>(
  apiFetch: TypedFetch,
  request: Request,
): Promise<HalObject<T>> {
  const response = await apiFetch(request).then(checkResponse);
  const json = await response.json();
  return new HalObject<T>(json as HalObjectShape<T>);
}
