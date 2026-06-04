import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
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
