/**
 * A minimal `fetch`-shaped function: request in, `Response` promise out.
 *
 * Deliberately narrower than `typeof fetch` — that type implies full Fetch API
 * compatibility (`mode`, `credentials`, `cache`, `redirect`, …) that an XHR-backed
 * implementation cannot honour. `createXhrFetch` only promises this much.
 */
export type BaseFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

// Statuses for which the Fetch spec forbids a non-null body — constructing a
// `Response` with a body for one of these throws a TypeError.
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

/**
 * Parses the CRLF-separated header block returned by `xhr.getAllResponseHeaders()`
 * into a `Headers` instance.
 */
function parseXhrResponseHeaders(raw: string): Headers {
  const headers = new Headers();
  for (const line of raw.split("\r\n")) {
    if (!line) continue;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const name = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (name) headers.append(name, value);
  }
  return headers;
}

/**
 * Builds a `fetch`-compatible function backed by `XMLHttpRequest`.
 *
 * `fetch` has no way to observe upload progress — `XMLHttpRequest.upload.onprogress`
 * is the only browser API that exposes it. This function exists SOLELY to bridge
 * that gap; it is not a general fetch replacement. It is meant to be used as the
 * base fetch at the bottom of the same `compose(...)` hook chain as `apiFetch` /
 * `contentFetch` (see `createContentUploadClient` in `client.ts`) — auth and
 * problem-details handling stay in those hooks, unchanged.
 *
 * Resolves a `Response` for every completed request (including non-2xx) so the
 * downstream `problemDetailsHook` can parse it into a `ProblemDetailError`. Only
 * transport-level failures (network error, timeout, abort) reject the promise.
 *
 * @param onProgress - Called with an integer 0–100 as upload bytes are sent.
 *                     Not invoked for non-upload-body requests or when the
 *                     browser can't compute total length.
 */
export function createXhrFetch(onProgress?: (percentage: number) => void): BaseFetch {
  return function xhrFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request =
      input instanceof Request && init === undefined ? input : new Request(input, init);

    return new Promise<Response>((resolve, reject) => {
      if (request.signal.aborted) {
        reject(new DOMException("The operation was aborted.", "AbortError"));
        return;
      }

      const xhr = new XMLHttpRequest();

      const onAbortSignal = () => {
        xhr.abort();
      };

      const cleanup = () => {
        request.signal.removeEventListener("abort", onAbortSignal);
      };

      request.signal.addEventListener("abort", onAbortSignal);

      xhr.open(request.method, request.url, true);

      // Forward every header verbatim — this is what carries Content-Type,
      // Content-Disposition, If-Match, and Authorization. Never special-case any of them.
      for (const [name, value] of request.headers) {
        xhr.setRequestHeader(name, value);
      }

      // "arraybuffer" rather than "blob": we only need the raw bytes to build a Response,
      // and MSW's XMLHttpRequest interceptor (used in tests) has a known Blob/undici
      // interop bug in its own internal response reconstruction when responseType is
      // "blob" — "arraybuffer" avoids that code path entirely and is simpler besides.
      xhr.responseType = "arraybuffer";

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress?.(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        cleanup();
        const headers = parseXhrResponseHeaders(xhr.getAllResponseHeaders());
        const hasBody = !NULL_BODY_STATUSES.has(xhr.status) && xhr.response != null;
        const body = hasBody ? (xhr.response as ArrayBuffer) : null;
        resolve(new Response(body, { status: xhr.status, statusText: xhr.statusText, headers }));
      };

      xhr.onerror = () => {
        cleanup();
        reject(new TypeError("Network request failed"));
      };

      xhr.ontimeout = () => {
        cleanup();
        reject(new TypeError("Network request timed out"));
      };

      xhr.onabort = () => {
        cleanup();
        reject(new DOMException("The operation was aborted.", "AbortError"));
      };

      (request.method === "GET" || request.method === "HEAD"
        ? Promise.resolve(null)
        : request.blob()
      ).then(
        (body) => xhr.send(body),
        (err: unknown) => {
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    });
  };
}
