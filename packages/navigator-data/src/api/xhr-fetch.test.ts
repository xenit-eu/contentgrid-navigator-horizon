/**
 * Tests for the XHR-backed fetch transport used exclusively to report upload
 * progress (fetch has no equivalent to `xhr.upload.onprogress`).
 */
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import { type MockXhr, assertXhrExists, makeFakeXhr } from "../../test-fixtures/xhr";
import { noopSupplier } from "../hooks/test-utils";
import { createContentUploadClient } from "./client";
import { createXhrFetch } from "./xhr-fetch";

function stubXhr(): { getLastXhr: () => MockXhr | undefined } {
  const { FakeXMLHttpRequest, getLastXhr } = makeFakeXhr();
  vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
  return { getLastXhr };
}

/** Encodes a string as an ArrayBuffer — matches what a real XHR with responseType "arraybuffer" returns. */
function toArrayBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createXhrFetch — upload progress", () => {
  it("reports rounded percentages via onProgress", async () => {
    const { getLastXhr } = stubXhr();
    const onProgress = vi.fn();
    const xhrFetch = createXhrFetch(onProgress);

    const promise = xhrFetch(
      new Request("https://api.example.com/x", { method: "PUT", body: "hello" }),
    );
    const xhr = getLastXhr();
    assertXhrExists(xhr);
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 33, total: 100 });
    expect(onProgress).toHaveBeenCalledWith(33);

    xhr.status = 204;
    xhr.onload?.();
    await promise;
  });

  it("does not call onProgress when the event is not length-computable", async () => {
    const { getLastXhr } = stubXhr();
    const onProgress = vi.fn();
    const xhrFetch = createXhrFetch(onProgress);

    const promise = xhrFetch(
      new Request("https://api.example.com/x", { method: "PUT", body: "hello" }),
    );
    const xhr = getLastXhr();
    assertXhrExists(xhr);
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());

    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 33, total: 100 });
    expect(onProgress).not.toHaveBeenCalled();

    xhr.status = 204;
    xhr.onload?.();
    await promise;
  });
});

describe("createXhrFetch — response construction", () => {
  it("resolves a 204 Response with a null body without throwing", async () => {
    const { getLastXhr } = stubXhr();
    const xhrFetch = createXhrFetch();

    const promise = xhrFetch(
      new Request("https://api.example.com/x", { method: "PUT", body: "hello" }),
    );
    const xhr = getLastXhr();
    assertXhrExists(xhr);
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());

    xhr.status = 204;
    xhr.statusText = "No Content";
    xhr.getAllResponseHeaders.mockReturnValue('ETag: "v2"\r\n');
    xhr.onload?.();

    const response = await promise;
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers.get("ETag")).toBe('"v2"');
  });
});

describe("createXhrFetch — transport-level failures", () => {
  it("rejects with a TypeError on onerror", async () => {
    const { getLastXhr } = stubXhr();
    const xhrFetch = createXhrFetch();

    const promise = xhrFetch(new Request("https://api.example.com/x"));
    const xhr = getLastXhr();
    assertXhrExists(xhr);
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());

    xhr.onerror?.();
    await expect(promise).rejects.toThrow(TypeError);
  });

  it("rejects with a TypeError when the response status is 0, without throwing a RangeError out of onload", async () => {
    const { getLastXhr } = stubXhr();
    const xhrFetch = createXhrFetch();

    const promise = xhrFetch(new Request("https://api.example.com/x"));
    const xhr = getLastXhr();
    assertXhrExists(xhr);
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());

    xhr.status = 0;
    xhr.onload?.();

    await expect(promise).rejects.toThrow(TypeError);
  });
});

describe("createXhrFetch — abort", () => {
  it("rejects with AbortError immediately when the signal is already aborted, without opening the request", async () => {
    const { getLastXhr } = stubXhr();
    const xhrFetch = createXhrFetch();

    const controller = new AbortController();
    controller.abort();

    const promise = xhrFetch(
      new Request("https://api.example.com/x", { signal: controller.signal }),
    );

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(getLastXhr()).toBeUndefined();
  });

  it("rejects with AbortError when the signal aborts mid-flight", async () => {
    const { getLastXhr } = stubXhr();
    const xhrFetch = createXhrFetch();

    const controller = new AbortController();
    const promise = xhrFetch(
      new Request("https://api.example.com/x", {
        method: "PUT",
        body: "hello",
        signal: controller.signal,
      }),
    );
    const xhr = getLastXhr();
    assertXhrExists(xhr);
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(xhr.abort).toHaveBeenCalled();
  });

  it("rejects with AbortError when aborted before send() has run, and never calls send", async () => {
    const { getLastXhr } = stubXhr();
    const xhrFetch = createXhrFetch();

    const controller = new AbortController();
    const promise = xhrFetch(
      new Request("https://api.example.com/x", {
        method: "PUT",
        body: "hello",
        signal: controller.signal,
      }),
    );

    // xhr.open() runs synchronously inside xhrFetch above, but send() only happens
    // after the async request.blob() read resolves. Aborting synchronously here —
    // in the same tick, before that read has had a chance to settle — exercises the
    // OPENED-but-not-SENT window where XHR's abort() fires no abort event at all.
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });

    const xhr = getLastXhr();
    assertXhrExists(xhr);
    expect(xhr.send).not.toHaveBeenCalled();
  });
});

describe("createContentUploadClient — problem details", () => {
  it("turns a non-2xx XHR response into a ProblemDetailError", async () => {
    const { getLastXhr } = stubXhr();
    const uploadFetch = createContentUploadClient(noopSupplier);

    const responsePromise = uploadFetch(
      new Request("https://api.example.com/invoices/1/document", {
        method: "PUT",
        body: "hello",
        headers: { "Content-Type": "text/plain" },
      }),
    ).catch((err: unknown) => err);

    // bearerHook awaits the token supplier before the XHR-backed fetch runs, so the
    // XHR instance doesn't exist yet at this point — re-query inside waitFor.
    await waitFor(() => expect(getLastXhr()?.send).toHaveBeenCalled());
    const xhr = getLastXhr();
    assertXhrExists(xhr);

    xhr.status = 415;
    xhr.statusText = "Unsupported Media Type";
    xhr.getAllResponseHeaders.mockReturnValue("Content-Type: application/problem+json\r\n");
    xhr.response = toArrayBuffer(JSON.stringify({ status: 415, title: "Unsupported Media Type" }));
    xhr.onload?.();

    const error = await responsePromise;
    expect(error).toBeInstanceOf(ProblemDetailError);
    expect((error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(415);
  });
});
