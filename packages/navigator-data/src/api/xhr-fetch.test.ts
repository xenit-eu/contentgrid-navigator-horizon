/**
 * Tests for the XHR-backed fetch transport used exclusively to report upload
 * progress (fetch has no equivalent to `xhr.upload.onprogress`).
 *
 * Covers:
 * - Every header on the Request is forwarded (If-Match, Content-Type, Content-Disposition).
 * - Progress callback fires with rounded percentages; skipped when !lengthComputable.
 * - A 204 resolves a Response with status 204 and a null body (no TypeError).
 * - A non-2xx resolves a Response carrying that status rather than throwing.
 * - onerror / ontimeout reject with a TypeError.
 * - Abort via an already-aborted signal rejects with AbortError without opening the request.
 * - Abort mid-flight rejects with AbortError.
 * - GET sends a null body.
 * - createContentUploadClient turns a non-2xx XHR response into a ProblemDetailError
 *   (regression guard for the dropped problem-details layer).
 */
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import { type MockXhr, makeFakeXhr, noopSupplier } from "../hooks/test-utils";
import { createContentUploadClient } from "./client";
import { createXhrFetch } from "./xhr-fetch";

function stubXhr(): { getLastXhr: () => MockXhr } {
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

describe("createXhrFetch — header forwarding", () => {
  it("forwards every header on the request, including If-Match, Content-Type, and Content-Disposition", async () => {
    const { getLastXhr } = stubXhr();
    const xhrFetch = createXhrFetch();

    const request = new Request("https://api.example.com/invoices/1/document", {
      method: "PUT",
      body: "hello",
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": 'attachment; filename="hello.txt"',
        "If-Match": '"v1"',
      },
    });

    const promise = xhrFetch(request);
    const xhr = getLastXhr();
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());

    xhr.status = 204;
    xhr.onload?.();
    await promise;

    const forwarded = xhr.setRequestHeader.mock.calls;
    expect(forwarded).toEqual(
      expect.arrayContaining([
        ["content-type", "text/plain"],
        ["content-disposition", 'attachment; filename="hello.txt"'],
        ["if-match", '"v1"'],
      ]),
    );
  });
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

  it("resolves (does not throw) a non-2xx status, carrying that status on the Response", async () => {
    const { getLastXhr } = stubXhr();
    const xhrFetch = createXhrFetch();

    const promise = xhrFetch(new Request("https://api.example.com/x"));
    const xhr = getLastXhr();
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());

    xhr.status = 412;
    xhr.statusText = "Precondition Failed";
    xhr.getAllResponseHeaders.mockReturnValue("Content-Type: application/problem+json\r\n");
    xhr.response = toArrayBuffer(JSON.stringify({ status: 412, title: "Precondition Failed" }));
    xhr.onload?.();

    const response = await promise;
    expect(response.status).toBe(412);
    expect(response.ok).toBe(false);
  });
});

describe("createXhrFetch — transport-level failures", () => {
  it("rejects with a TypeError on onerror", async () => {
    const { getLastXhr } = stubXhr();
    const xhrFetch = createXhrFetch();

    const promise = xhrFetch(new Request("https://api.example.com/x"));
    const xhr = getLastXhr();
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());

    xhr.onerror?.();
    await expect(promise).rejects.toThrow(TypeError);
  });

  it("rejects with a TypeError on ontimeout", async () => {
    const { getLastXhr } = stubXhr();
    const xhrFetch = createXhrFetch();

    const promise = xhrFetch(new Request("https://api.example.com/x"));
    const xhr = getLastXhr();
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());

    xhr.ontimeout?.();
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
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(xhr.abort).toHaveBeenCalled();
  });
});

describe("createXhrFetch — GET requests", () => {
  it("sends a null body for GET", async () => {
    const { getLastXhr } = stubXhr();
    const xhrFetch = createXhrFetch();

    const promise = xhrFetch(new Request("https://api.example.com/x", { method: "GET" }));
    const xhr = getLastXhr();
    await waitFor(() => expect(xhr.send).toHaveBeenCalled());

    expect(xhr.send).toHaveBeenCalledWith(null);

    xhr.status = 200;
    xhr.onload?.();
    await promise;
  });
});

describe("createContentUploadClient — problem-details regression guard", () => {
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

    xhr.status = 412;
    xhr.statusText = "Precondition Failed";
    xhr.getAllResponseHeaders.mockReturnValue("Content-Type: application/problem+json\r\n");
    xhr.response = toArrayBuffer(
      JSON.stringify({
        status: 412,
        title: "Precondition Failed",
        type: "https://contentgrid.cloud/problems/unsatisfied-version",
      }),
    );
    xhr.onload?.();

    const error = await responsePromise;
    expect(error).toBeInstanceOf(ProblemDetailError);
    expect((error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(412);
  });
});
