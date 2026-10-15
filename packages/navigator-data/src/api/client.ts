import createBearerAuthenticationHook, {
  type AuthenticationTokenSupplier,
} from "@contentgrid/fetch-hook-authentication";
import createHook, { type FetchHook, compose } from "@contentgrid/fetch-hooks";
import { setHeader } from "@contentgrid/fetch-hooks/request";
import { ValueProviderResolver } from "@contentgrid/fetch-hooks/value-provider";
import { checkResponse } from "@contentgrid/problem-details";
import { createTypedFetch } from "@contentgrid/typed-fetch";
import { ACCEPT_HAL } from "./content-types";

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

/** Statuses whose `Response` must have a null body. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/** Parses `xhr.getAllResponseHeaders()` (CRLF-separated `name: value` lines) into `Headers`. */
function parseResponseHeaders(raw: string): Headers {
  const headers = new Headers();
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const separator = line.indexOf(":");
    if (separator > 0) {
      headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
  }
  return headers;
}

/**
 * Like fetch, but sends with XMLHttpRequest so it can report upload progress (0–100). Mirrors
 * fetch's contract: honours `signal` (rejects with an `AbortError` `DOMException`), rejects with
 * a `TypeError` on a network error or timeout, and keeps every response header the browser
 * exposes (e.g. the content's new `ETag`).
 */
function createUploadProgressFetch(onProgress: (percentage: number) => void): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const { signal } = request;
    signal.throwIfAborted();
    const body = await request.blob();

    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();

      const settle = (finish: () => void) => {
        signal.removeEventListener("abort", abort);
        finish();
      };

      xhr.open(request.method, request.url);
      request.headers.forEach((value, name) => xhr.setRequestHeader(name, value));

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () =>
        settle(() => {
          const responseBody = NULL_BODY_STATUSES.has(xhr.status) ? null : (xhr.response as string);
          resolve(
            new Response(responseBody, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: parseResponseHeaders(xhr.getAllResponseHeaders()),
            }),
          );
        });
      xhr.onerror = () => settle(() => reject(new TypeError("Network request failed")));
      xhr.ontimeout = () => settle(() => reject(new TypeError("Network request timed out")));
      const rejectAborted = () =>
        settle(() =>
          reject(signal.reason ?? new DOMException("The upload was aborted", "AbortError")),
        );
      xhr.onabort = rejectAborted;

      // Aborted while the body was being read.
      if (signal.aborted) {
        rejectAborted();
        return;
      }
      signal.addEventListener("abort", abort);
      xhr.send(body);
    });
  };
}

/** Client for file content. `withUploadProgress` is the same client with upload progress. */
export type ContentFetch = TypedFetch & {
  withUploadProgress(onProgress: (percentage: number) => void): TypedFetch;
};

export function createContentClient(tokenSupplier: AuthenticationTokenSupplier): ContentFetch {
  const addAuthAndErrorHandling = compose(bearerHook(tokenSupplier), problemDetailsHook);

  const contentFetch = createTypedFetch(addAuthAndErrorHandling(boundFetch));
  const withUploadProgress = (onProgress: (percentage: number) => void) =>
    createTypedFetch(addAuthAndErrorHandling(createUploadProgressFetch(onProgress)));

  return Object.assign(contentFetch, { withUploadProgress });
}
