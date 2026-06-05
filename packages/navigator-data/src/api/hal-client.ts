import { HalObject, HalSlice } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { createRequest } from "@contentgrid/typed-fetch";
import type { TypedFetch } from "./client";

export { resolveTemplate, resolveTemplateRequired } from "@contentgrid/hal-forms";

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
  url: string,
): Promise<HalFetchResult<T>> {
  const response = await apiFetch(createRequest({ method: "GET", url }, {}));
  const etag = response.headers.get("ETag");
  const json = await response.json();
  return {
    object: new HalObject<T>(json as unknown as HalObjectShape<T>),
    etag,
  };
}

export async function fetchHalSlice<T = Record<string, unknown>>(
  apiFetch: TypedFetch,
  url: string,
): Promise<HalSlice<T>> {
  const { object } = await fetchHal(apiFetch, url);
  return HalSlice.from<T>(object);
}
