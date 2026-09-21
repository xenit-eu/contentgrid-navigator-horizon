import createBearerAuthenticationHook, {
  type AuthenticationTokenSupplier,
} from "@contentgrid/fetch-hook-authentication";
import createHook, { type FetchHook, compose } from "@contentgrid/fetch-hooks";
import { setHeader } from "@contentgrid/fetch-hooks/request";
import { ValueProviderResolver } from "@contentgrid/fetch-hooks/value-provider";
import { checkResponse } from "@contentgrid/problem-details";
import { createTypedFetch } from "@contentgrid/typed-fetch";
import { ACCEPT_HAL } from "./content-types";
import { type BaseFetch, createXhrFetch } from "./xhr-fetch";

// TypedFetch is defined in @contentgrid/typed-fetch's fetch.d.ts but not re-exported
// from its index.d.ts — this alias bridges the gap until upstream adds the export.
export type TypedFetch = ReturnType<typeof createTypedFetch>;

export type { AuthenticationTokenSupplier };

const problemDetailsHook = createHook(async (invocation) => {
  const response = await invocation.next();
  return checkResponse(response);
});

function bearerHook(tokenSupplier: AuthenticationTokenSupplier): FetchHook {
  return createBearerAuthenticationHook({
    tokenSupplier: ValueProviderResolver.constant(tokenSupplier),
  });
}

// Resolve globalThis.fetch at call time — MSW (and tests) patch it after this
// module loads — and invoke it on globalThis: browsers throw "Illegal invocation"
// when fetch is called detached (Node does not, so unit tests won't catch it).
const boundFetch: typeof fetch = (...args) => globalThis.fetch(...args);

export function createApiClient(tokenSupplier: AuthenticationTokenSupplier): TypedFetch {
  const hookedFetch = compose(
    setHeader("Accept", ACCEPT_HAL),
    bearerHook(tokenSupplier),
    problemDetailsHook,
  )(boundFetch);
  return createTypedFetch(hookedFetch);
}

export function createContentClient(tokenSupplier: AuthenticationTokenSupplier): TypedFetch {
  const hookedFetch = compose(bearerHook(tokenSupplier), problemDetailsHook)(boundFetch);
  return createTypedFetch(hookedFetch);
}

/**
 * Same hook chain as `createContentClient` (bearer auth + problem-details, no
 * `Accept: hal+json`) but backed by an XHR transport that can report upload
 * progress — `fetch` has no equivalent to `xhr.upload.onprogress`. Use only for
 * content PUTs that need progress reporting; use `createContentClient` otherwise.
 */
export function createContentUploadClient(
  tokenSupplier: AuthenticationTokenSupplier,
  onProgress?: (percentage: number) => void,
): TypedFetch {
  const xhrFetch: BaseFetch = createXhrFetch(onProgress);
  const hookedFetch = compose(bearerHook(tokenSupplier), problemDetailsHook)(xhrFetch);
  return createTypedFetch(hookedFetch);
}
