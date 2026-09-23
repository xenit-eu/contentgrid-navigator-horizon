/**
 * Tests for `requestRendition`'s state machine.
 *
 * Covers every transition in data-model.md's "RenditionJob" diagram — identically for the
 * initial request and a poll, per the diagram's symmetric initial/poll branches:
 * - 200 directly on the initial request → ready
 * - 202 + Location → poll → 200 → ready
 * - invalid-conversion problem (on the initial request, and mid-poll) → unsupported
 * - a bare problem/error (500, no `type`) on the initial request OR a poll → propagates the
 *   underlying `ProblemDetailError`/`Error` unchanged, never wrapped
 * - 202 with no Location header, on the initial request OR a poll → RenditionProtocolError
 * - an unexpected 2xx status (not 200/202), on the initial request OR a poll →
 *   RenditionProtocolError
 * - polling past the ceiling → RenditionTimeoutError
 * - an aborted signal, before starting and mid-poll → AbortError
 *
 * Uses `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync` to flush the poll interval —
 * MSW's response resolves over real microtasks, but the interval wait between polls is a
 * real `setTimeout` the fake clock must be advanced past.
 */
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProblemDetailError } from "@contentgrid/problem-details";
import { createRenditionHandlers } from "../../test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import { createContentClient } from "../api/client";
import { noopSupplier } from "../hooks/test-utils";
import { RenditionProtocolError, RenditionTimeoutError, requestRendition } from "./rendition-job";

const REQUEST_URL = "https://api.example.com/renditions/get/pdf";
const JOB_URL = "https://api.example.com/renditions/jobs/job-1";
const URI_TEMPLATE = "https://api.example.com/renditions/get/pdf{?url}";
const CONTENT_HREF = "https://api.example.com/animals/1/photo";

const contentFetch = createContentClient(noopSupplier);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Advances the fake clock by `intervalMs`, `times` times, flushing microtasks between each. */
async function advancePolls(intervalMs: number, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    await vi.advanceTimersByTimeAsync(intervalMs);
  }
}

describe("requestRendition — ready", () => {
  it("returns ready bytes when the initial request answers 200 directly", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    server.use(
      ...createRenditionHandlers({
        url: REQUEST_URL,
        jobUrl: JOB_URL,
        pendingPolls: 0,
        outcome: "ready",
        pdfBytes,
      }),
    );

    const controller = new AbortController();
    const result = await requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
      signal: controller.signal,
      intervalMs: 1000,
      timeoutMs: 10000,
    });

    expect(result.kind).toBe("ready");
    expect(result.kind === "ready" && new Uint8Array(result.bytes)).toEqual(pdfBytes);
  });

  it("polls 202 pendingPolls times, then returns ready", async () => {
    server.use(
      ...createRenditionHandlers({
        url: REQUEST_URL,
        jobUrl: JOB_URL,
        pendingPolls: 2,
        outcome: "ready",
      }),
    );

    const controller = new AbortController();
    const resultPromise = requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
      signal: controller.signal,
      intervalMs: 1000,
      timeoutMs: 10000,
    });

    await advancePolls(1000, 2);
    const result = await resultPromise;

    expect(result.kind).toBe("ready");
  });
});

describe("requestRendition — unsupported (invalid-conversion)", () => {
  it("returns unsupported when the poll answers invalid-conversion", async () => {
    server.use(
      ...createRenditionHandlers({
        url: REQUEST_URL,
        jobUrl: JOB_URL,
        pendingPolls: 0,
        outcome: "invalid-conversion",
      }),
    );

    const controller = new AbortController();
    const result = await requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
      signal: controller.signal,
      intervalMs: 1000,
      timeoutMs: 10000,
    });

    expect(result).toEqual({ kind: "unsupported" });
  });

  it("returns unsupported when the very first (initial) response is invalid-conversion", async () => {
    server.use(
      http.get(REQUEST_URL, () =>
        HttpResponse.json(
          {
            status: 422,
            title: "Cannot convert to PDF",
            type: "https://contentgrid.cloud/problems/renditions/invalid-conversion",
          },
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const controller = new AbortController();
    const result = await requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
      signal: controller.signal,
      intervalMs: 1000,
      timeoutMs: 10000,
    });

    expect(result).toEqual({ kind: "unsupported" });
  });

  it("returns unsupported after several pending polls", async () => {
    server.use(
      ...createRenditionHandlers({
        url: REQUEST_URL,
        jobUrl: JOB_URL,
        pendingPolls: 2,
        outcome: "invalid-conversion",
      }),
    );

    const controller = new AbortController();
    const resultPromise = requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
      signal: controller.signal,
      intervalMs: 1000,
      timeoutMs: 10000,
    });

    await advancePolls(1000, 2);
    const result = await resultPromise;

    expect(result).toEqual({ kind: "unsupported" });
  });
});

describe("requestRendition — protocol violations (initial request or a poll, identically)", () => {
  it("throws RenditionProtocolError when the initial request answers 202 with no Location header", async () => {
    server.use(http.get(REQUEST_URL, () => new HttpResponse(null, { status: 202 })));

    const controller = new AbortController();
    await expect(
      requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
        signal: controller.signal,
        intervalMs: 1000,
        timeoutMs: 10000,
      }),
    ).rejects.toThrow(RenditionProtocolError);
  });

  it("throws RenditionProtocolError when a poll answers 202 with no Location header", async () => {
    server.use(
      http.get(
        REQUEST_URL,
        () => new HttpResponse(null, { status: 202, headers: { Location: JOB_URL } }),
      ),
      http.get(JOB_URL, () => new HttpResponse(null, { status: 202 })),
    );

    const controller = new AbortController();
    // The first poll happens immediately (poll-first-then-wait) — no timer advance needed.
    await expect(
      requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
        signal: controller.signal,
        intervalMs: 1000,
        timeoutMs: 10000,
      }),
    ).rejects.toThrow(RenditionProtocolError);
  });

  it("throws RenditionProtocolError for an unexpected 2xx status on the initial request", async () => {
    server.use(http.get(REQUEST_URL, () => new HttpResponse(null, { status: 204 })));

    const controller = new AbortController();
    await expect(
      requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
        signal: controller.signal,
        intervalMs: 1000,
        timeoutMs: 10000,
      }),
    ).rejects.toThrow(RenditionProtocolError);
  });

  it("throws RenditionProtocolError for an unexpected 2xx status on a poll", async () => {
    server.use(
      http.get(
        REQUEST_URL,
        () => new HttpResponse(null, { status: 202, headers: { Location: JOB_URL } }),
      ),
      http.get(JOB_URL, () => new HttpResponse(null, { status: 204 })),
    );

    const controller = new AbortController();
    await expect(
      requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
        signal: controller.signal,
        intervalMs: 1000,
        timeoutMs: 10000,
      }),
    ).rejects.toThrow(RenditionProtocolError);
  });
});

describe("requestRendition — other failures propagate unchanged (initial request or a poll, identically)", () => {
  it("rejects with the underlying ProblemDetailError (not RenditionProtocolError) on a bare 500 on the initial request", async () => {
    server.use(
      http.get(REQUEST_URL, () =>
        HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const controller = new AbortController();
    const resultPromise = requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
      signal: controller.signal,
      intervalMs: 1000,
      timeoutMs: 10000,
    });

    await expect(resultPromise).rejects.toBeInstanceOf(ProblemDetailError);
    await expect(resultPromise).rejects.not.toBeInstanceOf(RenditionProtocolError);
  });

  it("rejects with the underlying ProblemDetailError (not wrapped) on a poll-time 500", async () => {
    server.use(
      ...createRenditionHandlers({
        url: REQUEST_URL,
        jobUrl: JOB_URL,
        pendingPolls: 1,
        outcome: "error",
      }),
    );

    const controller = new AbortController();
    const resultPromise = requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
      signal: controller.signal,
      intervalMs: 1000,
      timeoutMs: 10000,
    });
    const assertion = expect(resultPromise).rejects.toBeInstanceOf(ProblemDetailError);

    await advancePolls(1000, 1);
    await assertion;
    await expect(resultPromise).rejects.not.toBeInstanceOf(RenditionProtocolError);
  });
});

describe("requestRendition — timeout", () => {
  it("throws RenditionTimeoutError once now >= deadline", async () => {
    server.use(
      ...createRenditionHandlers({
        url: REQUEST_URL,
        jobUrl: JOB_URL,
        pendingPolls: 0,
        outcome: "never",
      }),
    );

    const controller = new AbortController();
    const resultPromise = requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
      signal: controller.signal,
      intervalMs: 1000,
      timeoutMs: 3000,
    });
    const assertion = expect(resultPromise).rejects.toBeInstanceOf(RenditionTimeoutError);

    await advancePolls(1000, 5);
    await assertion;
  });
});

describe("requestRendition — abort", () => {
  it("rejects with a named AbortError when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
        signal: controller.signal,
        intervalMs: 1000,
        timeoutMs: 10000,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects with a named AbortError when aborted during the interval wait", async () => {
    server.use(
      ...createRenditionHandlers({
        url: REQUEST_URL,
        jobUrl: JOB_URL,
        pendingPolls: 5,
        outcome: "ready",
      }),
    );

    const controller = new AbortController();
    const resultPromise = requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
      signal: controller.signal,
      intervalMs: 1000,
      timeoutMs: 10000,
    });
    const assertion = expect(resultPromise).rejects.toMatchObject({ name: "AbortError" });

    await advancePolls(1000, 1);
    controller.abort();
    await advancePolls(1000, 1);
    await assertion;
  });

  it("stops polling after abort — no further handler calls", async () => {
    let pollCount = 0;
    server.use(
      http.get(
        REQUEST_URL,
        () => new HttpResponse(null, { status: 202, headers: { Location: JOB_URL } }),
      ),
      http.get(JOB_URL, () => {
        pollCount += 1;
        return new HttpResponse(null, { status: 202, headers: { Location: JOB_URL } });
      }),
    );

    const controller = new AbortController();
    const resultPromise = requestRendition(contentFetch, URI_TEMPLATE, CONTENT_HREF, {
      signal: controller.signal,
      intervalMs: 1000,
      timeoutMs: 60000,
    });
    resultPromise.catch(() => {
      // Expected rejection (AbortError) — asserted below via `assertion`.
    });
    const assertion = expect(resultPromise).rejects.toMatchObject({ name: "AbortError" });

    await advancePolls(1000, 2);
    const pollCountAtAbort = pollCount;
    controller.abort();
    await advancePolls(1000, 3);

    await assertion;
    expect(pollCount).toBe(pollCountAtAbort);
  });
});
