/**
 * The platform's PDF rendition protocol, as a pure async state machine — no React, no
 * TanStack Query. `useContentPreview` (`hooks/preview/use-content-preview.ts`) is the only
 * caller; kept separate so the polling/timeout/abort logic can be unit-tested with fake
 * timers without a query client or a rendered component in the loop.
 *
 * See `specs/002-pdf-viewer/contracts/rendition-service.md` and `data-model.md`'s
 * "RenditionJob" state machine for the exact contract this implements.
 *
 * Every request goes through the caller's `contentFetch` — the same authenticated client
 * used for stored-content downloads. The frontend does not exchange tokens; whatever
 * exchange the rendition service needs happens on the platform side (research.md §8.3).
 */
import UriTemplate from "@contentgrid/uri-template";
import type { TypedFetch } from "../api/client";
import { RENDITION_INVALID_CONVERSION } from "../api/problem-details/constants";
import { isProblemOfType } from "../api/problem-details/guards";

/** Default poll interval, used when `renditionPollIntervalMs` is not configured. */
export const DEFAULT_RENDITION_POLL_INTERVAL_MS = 2000;

/** Default polling ceiling, used when `renditionTimeoutMs` is not configured. */
export const DEFAULT_RENDITION_TIMEOUT_MS = 60000;

export interface RequestRenditionOptions {
  /** Aborts the in-flight request or the polling loop; rejects with a named `AbortError`. */
  readonly signal: AbortSignal;
  /** Delay between polls of the job URL, once a job is pending. */
  readonly intervalMs: number;
  /** Polling ceiling from the first request; exceeding it throws {@link RenditionTimeoutError}. */
  readonly timeoutMs: number;
}

/** Successful outcome of a rendition job: displayable PDF bytes, or an unsupported source. */
export type RenditionResult =
  | { readonly kind: "ready"; readonly bytes: ArrayBuffer }
  | { readonly kind: "unsupported" };

/**
 * The polling loop ran for `timeoutMs` without the job reaching a terminal state
 * (`ready`/`unsupported`). Not thrown for an aborted request — that rejects with a named
 * `AbortError` `DOMException` instead.
 */
export class RenditionTimeoutError extends Error {
  constructor(message = "The rendition did not complete within the configured timeout.") {
    super(message);
    this.name = "RenditionTimeoutError";
  }
}

/**
 * The rendition service violated the documented protocol contract — not an application-level
 * failure: a `202 Accepted` response with no `Location` header, or an unexpected 2xx status
 * (anything other than `200`/`202`). Applies identically to the initial request and to a
 * poll. A genuine problem (typed or opaque `ProblemDetailError`) or network error is never
 * wrapped as this — it propagates unchanged in both phases, so the caller can still render
 * the real problem detail; see `fetchStep`.
 */
export class RenditionProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenditionProtocolError";
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("The rendition request was aborted.", "AbortError");
  }
}

/** Rejects after `ms`, or immediately with a named `AbortError` if `signal` fires first. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    throwIfAborted(signal);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("The rendition request was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

type Step =
  | { readonly kind: "ready"; readonly bytes: ArrayBuffer }
  | { readonly kind: "unsupported" }
  | { readonly kind: "pending"; readonly jobUrl: string };

/**
 * Performs one GET (the initial request, or one poll of the job URL) and classifies the
 * result. `contentFetch`'s composed fetch hooks already throw `ProblemDetailError` for any
 * non-2xx response (see `api/client.ts`'s `problemDetailsHook`), so every failure path here
 * is a caught rejection, not a status check.
 *
 * The initial request and a poll behave identically on failure: `RENDITION_INVALID_CONVERSION`
 * maps to `unsupported`; any other problem or network error propagates unchanged, so the
 * caller sees the real error. Only a genuine protocol violation — `202` with no `Location`,
 * or an unexpected 2xx status — is wrapped as `RenditionProtocolError`, in either phase.
 * `phase` is used only to name which request failed in that message.
 */
async function fetchStep(
  fetch: TypedFetch,
  url: string,
  signal: AbortSignal,
  phase: "initial" | "poll",
): Promise<Step> {
  let response: Response;
  try {
    response = await fetch(new Request(url, { signal }));
  } catch (error) {
    if (isProblemOfType(error, RENDITION_INVALID_CONVERSION)) {
      return { kind: "unsupported" };
    }
    // Any other typed/opaque problem, an aborted request (a DOMException named
    // AbortError — isProblemOfType is false for it), or a network failure all propagate
    // unchanged in both phases — only the protocol violations below are wrapped as
    // RenditionProtocolError.
    throw error;
  }

  if (response.status === 200) {
    const bytes = await response.arrayBuffer();
    return { kind: "ready", bytes };
  }

  if (response.status === 202) {
    const jobUrl = response.headers.get("Location");
    if (jobUrl === null) {
      throw new RenditionProtocolError(
        `Rendition service returned 202 Accepted without a Location header (${phase} request).`,
      );
    }
    return { kind: "pending", jobUrl };
  }

  throw new RenditionProtocolError(
    `Rendition service returned an unexpected status ${response.status} (${phase} request).`,
  );
}

/**
 * Runs the rendition protocol for one content link: expands `uriTemplate` with
 * `contentHref` as the opaque `url` value, makes the initial request, and — if the
 * service answers `202 Accepted` — polls the returned job URL until it reaches a
 * terminal state, the caller aborts, or `timeoutMs` elapses.
 *
 * Poll-first-then-wait: each poll attempt happens immediately, and only a "still
 * pending" result is followed by an `intervalMs` wait before the next attempt — a job
 * that has already finished is never delayed by a sleep.
 *
 * @param fetch - The authenticated content client (`contentFetch`); never `apiFetch`.
 * @param uriTemplate - The configured rendition URI template (must contain `{?url}`).
 * @param contentHref - The content attribute's `cg:content` link href, passed as the
 *   template's opaque `url` value — never otherwise inspected or built into a path.
 * @throws {RenditionProtocolError} a protocol violation (`202` with no `Location`, or an
 *   unexpected 2xx status) on the initial request or a poll.
 * @throws {RenditionTimeoutError} no terminal answer arrived within `timeoutMs`.
 * @throws {DOMException} named `AbortError`, when `signal` fires.
 * @throws {Error} (typically `ProblemDetailError`) for any other failure, on the initial
 *   request or a poll alike.
 */
export async function requestRendition(
  fetch: TypedFetch,
  uriTemplate: string,
  contentHref: string,
  options: RequestRenditionOptions,
): Promise<RenditionResult> {
  const { signal, intervalMs, timeoutMs } = options;
  const deadline = Date.now() + timeoutMs;
  const requestUrl = new UriTemplate(uriTemplate).expand({ url: contentHref });

  throwIfAborted(signal);
  const initial = await fetchStep(fetch, requestUrl, signal, "initial");
  if (initial.kind !== "pending") {
    return initial;
  }
  const jobUrl = initial.jobUrl;

  for (;;) {
    const step = await fetchStep(fetch, jobUrl, signal, "poll");
    if (step.kind !== "pending") {
      return step;
    }
    if (Date.now() >= deadline) {
      throw new RenditionTimeoutError();
    }
    await delay(Math.min(intervalMs, Math.max(deadline - Date.now(), 0)), signal);
    if (Date.now() >= deadline) {
      throw new RenditionTimeoutError();
    }
  }
}
