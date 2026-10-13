import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProblemDetailError } from "@contentgrid/problem-details";
import { createRequest } from "@contentgrid/typed-fetch";
import { server } from "../../test-setup";
import { type AuthenticationTokenSupplier, createApiClient, createContentClient } from "./client";
import { ACCEPT_HAL } from "./content-types";

const TEST_URL = "https://api.example.com/test";

const staticSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-bearer-token",
  expiresAt: null,
});

describe("createApiClient", () => {
  it("sets the Accept header for HAL content negotiation", async () => {
    let capturedAccept: string | null = null;
    server.use(
      http.get(TEST_URL, ({ request }) => {
        capturedAccept = request.headers.get("Accept");
        return HttpResponse.json({});
      }),
    );

    const apiFetch = createApiClient(staticSupplier);
    await apiFetch(createRequest({ url: TEST_URL, method: "GET" }, {}));

    expect(capturedAccept).toBe(ACCEPT_HAL);
  });

  it("sets the Authorization Bearer header from the token supplier", async () => {
    let capturedAuth: string | null = null;
    server.use(
      http.get(TEST_URL, ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json({});
      }),
    );

    const apiFetch = createApiClient(staticSupplier);
    await apiFetch(createRequest({ url: TEST_URL, method: "GET" }, {}));

    expect(capturedAuth).toBe("Bearer test-bearer-token");
  });

  it("throws ProblemDetailError on a 4xx response", async () => {
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json(
          { status: 404, title: "Not Found" },
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const apiFetch = createApiClient(staticSupplier);
    await expect(
      apiFetch(createRequest({ url: TEST_URL, method: "GET" }, {})),
    ).rejects.toBeInstanceOf(ProblemDetailError);
  });

  it("throws ProblemDetailError on a 5xx response", async () => {
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const apiFetch = createApiClient(staticSupplier);
    await expect(
      apiFetch(createRequest({ url: TEST_URL, method: "GET" }, {})),
    ).rejects.toBeInstanceOf(ProblemDetailError);
  });
});

describe("createContentClient", () => {
  it("sets the Authorization Bearer header", async () => {
    let capturedAuth: string | null = null;
    server.use(
      http.get(TEST_URL, ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return new HttpResponse(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "application/octet-stream" },
        });
      }),
    );

    const contentFetch = createContentClient(staticSupplier);
    await contentFetch(createRequest({ url: TEST_URL, method: "GET" }, {}));

    expect(capturedAuth).toBe("Bearer test-bearer-token");
  });

  it("does NOT set an Accept header for HAL", async () => {
    let capturedAccept: string | null = null;
    server.use(
      http.get(TEST_URL, ({ request }) => {
        capturedAccept = request.headers.get("Accept");
        return new HttpResponse(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "application/octet-stream" },
        });
      }),
    );

    const contentFetch = createContentClient(staticSupplier);
    await contentFetch(createRequest({ url: TEST_URL, method: "GET" }, {}));

    expect(capturedAccept).not.toBe(ACCEPT_HAL);
  });

  it("throws ProblemDetailError on a 4xx response", async () => {
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json(
          { status: 403, title: "Forbidden" },
          { status: 403, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const contentFetch = createContentClient(staticSupplier);
    await expect(
      contentFetch(createRequest({ url: TEST_URL, method: "GET" }, {})),
    ).rejects.toBeInstanceOf(ProblemDetailError);
  });
});

describe("createContentClient — withUploadProgress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * A fake XMLHttpRequest: MSW can't produce upload progress events, so each test drives them
   * (and the server's answer) by calling the handlers itself.
   */
  class FakeXMLHttpRequest {
    open = vi.fn();
    setRequestHeader = vi.fn();
    send = vi.fn();
    response: unknown = "";
    status = 204;
    getResponseHeader = vi.fn((): string | null => null);
    upload: { onprogress: ((event: Partial<ProgressEvent>) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
  }

  /** Starts an upload through a fake XMLHttpRequest and returns it once the body is sent. */
  async function startUpload(onProgress = vi.fn()) {
    const created: FakeXMLHttpRequest[] = [];
    vi.stubGlobal(
      "XMLHttpRequest",
      class extends FakeXMLHttpRequest {
        constructor() {
          super();
          created.push(this);
        }
      },
    );
    const uploadFetch = createContentClient(staticSupplier).withUploadProgress(onProgress);

    const response = uploadFetch(
      new Request(TEST_URL, { method: "PUT", body: "hello", headers: { "If-None-Match": "*" } }),
    ).catch((err: unknown) => err);

    // The login step runs before the XHR is created — wait for it to be sent.
    await waitFor(() => expect(created[0]?.send).toHaveBeenCalled());
    return { xhr: created[0], response };
  }

  it("reports the percentage sent, rounded", async () => {
    const onProgress = vi.fn();
    const { xhr } = await startUpload(onProgress);

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 3 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 2, total: 0 });

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(33);
  });

  it("resolves a 204 answer without a body", async () => {
    const { xhr, response } = await startUpload();

    xhr.status = 204;
    xhr.onload?.();

    const result = (await response) as Response;
    expect(result.status).toBe(204);
    expect(result.body).toBeNull();
  });

  it("turns an error answer into a ProblemDetailError, like the fetch client", async () => {
    const { xhr, response } = await startUpload();

    xhr.status = 412;
    xhr.getResponseHeader.mockReturnValue("application/problem+json");
    xhr.response = JSON.stringify({ status: 412 });
    xhr.onload?.();

    expect(await response).toBeInstanceOf(ProblemDetailError);
  });
});
