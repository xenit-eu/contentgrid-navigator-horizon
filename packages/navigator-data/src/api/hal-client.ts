import { HalObject, HalSlice } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { createRequest } from "@contentgrid/typed-fetch";
import type { TypedFetch } from "./client";

export { resolveTemplate, resolveTemplateRequired } from "@contentgrid/hal-forms";

export async function fetchHal<T = Record<string, unknown>>(
  apiFetch: TypedFetch,
  url: string,
): Promise<HalObject<T>> {
  const response = await apiFetch(createRequest({ method: "GET", url }, {}));
  const json = await response.json();
  return new HalObject<T>(json as unknown as HalObjectShape<T>);
}

export async function fetchHalSlice<T = Record<string, unknown>>(
  apiFetch: TypedFetch,
  url: string,
): Promise<HalSlice<T>> {
  return HalSlice.from<T>(await fetchHal(apiFetch, url));
}
