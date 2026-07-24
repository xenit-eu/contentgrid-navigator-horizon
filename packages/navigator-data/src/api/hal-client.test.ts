import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { HalObject, HalSlice } from "@contentgrid/hal";
import { ProblemDetailError } from "@contentgrid/problem-details";
import { server } from "../../test-setup";
import { type AuthenticationTokenSupplier, createApiClient } from "./client";
import { addIfMatchHeader, fetchHal, fetchHalSlice, fetchVoid } from "./hal-client";

const TEST_URL = "https://api.example.com/entities/1";
const COLLECTION_URL = "https://api.example.com/entities";

const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

describe("fetchHal", () => {
  it("returns a HalObject parsed from the response", async () => {
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json({
          id: "1",
          name: "Test Entity",
          _links: { self: { href: TEST_URL } },
        }),
      ),
    );

    const apiFetch = createApiClient(noopSupplier);
    const { object } = await fetchHal(apiFetch, new Request(TEST_URL));

    expect(object).toBeInstanceOf(HalObject);
    expect((object.data as Record<string, unknown>).id).toBe("1");
    expect((object.data as Record<string, unknown>).name).toBe("Test Entity");
  });

  it("captures the ETag response header", async () => {
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json(
          { id: "1", _links: { self: { href: TEST_URL } } },
          { headers: { ETag: '"abc123"' } },
        ),
      ),
    );

    const apiFetch = createApiClient(noopSupplier);
    const { etag } = await fetchHal(apiFetch, new Request(TEST_URL));

    expect(etag).toBe('"abc123"');
  });

  it("returns null etag when the server sends no ETag header", async () => {
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json({ id: "1", _links: { self: { href: TEST_URL } } }),
      ),
    );

    const apiFetch = createApiClient(noopSupplier);
    const { etag } = await fetchHal(apiFetch, new Request(TEST_URL));

    expect(etag).toBeNull();
  });

  it("throws ProblemDetailError on a 4xx problem detail response", async () => {
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json(
          {
            status: 404,
            title: "Not Found",
            type: "https://contentgrid.cloud/problems/not-found/entity-item",
          },
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const apiFetch = createApiClient(noopSupplier);
    await expect(fetchHal(apiFetch, new Request(TEST_URL))).rejects.toBeInstanceOf(
      ProblemDetailError,
    );
  });

  it("throws ProblemDetailError on a 500 problem detail response", async () => {
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const apiFetch = createApiClient(noopSupplier);
    await expect(fetchHal(apiFetch, new Request(TEST_URL))).rejects.toBeInstanceOf(
      ProblemDetailError,
    );
  });

  it("rejects rather than returning garbage data when a 2xx response body isn't valid JSON", async () => {
    // Realistic case: an intermediary proxy/gateway returns a 200 with an HTML
    // body instead of the expected HAL+JSON (e.g. a captive portal or misrouted request).
    server.use(
      http.get(TEST_URL, () => new HttpResponse("<html>not json</html>", { status: 200 })),
    );

    const apiFetch = createApiClient(noopSupplier);
    await expect(fetchHal(apiFetch, new Request(TEST_URL))).rejects.toThrow();
  });
});

describe("fetchHalSlice", () => {
  it("returns a HalSlice parsed from a collection response", async () => {
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _links: { self: { href: COLLECTION_URL } },
          _embedded: {
            item: [
              { id: "1", name: "Alpha", _links: { self: { href: `${COLLECTION_URL}/1` } } },
              { id: "2", name: "Beta", _links: { self: { href: `${COLLECTION_URL}/2` } } },
            ],
          },
          page: { size: 20, total_items_exact: 2 },
        }),
      ),
    );

    const apiFetch = createApiClient(noopSupplier);
    const result = await fetchHalSlice(apiFetch, new Request(COLLECTION_URL));

    expect(result).toBeInstanceOf(HalSlice);
    expect(result.items).toHaveLength(2);
  });

  it("throws ProblemDetailError on an error response", async () => {
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json(
          { status: 403, title: "Forbidden" },
          { status: 403, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const apiFetch = createApiClient(noopSupplier);
    await expect(fetchHalSlice(apiFetch, new Request(COLLECTION_URL))).rejects.toBeInstanceOf(
      ProblemDetailError,
    );
  });
});

describe("addIfMatchHeader", () => {
  it("adds If-Match header verbatim when etag is non-null", () => {
    const req = new Request("https://api.example.com/entities/1", { method: "PATCH" });
    const result = addIfMatchHeader(req, '"v1"');
    expect(result.headers.get("If-Match")).toBe('"v1"');
  });

  it("returns request unchanged when etag is null (no If-Match added)", () => {
    const req = new Request("https://api.example.com/entities/1", { method: "PATCH" });
    const result = addIfMatchHeader(req, null);
    expect(result.headers.get("If-Match")).toBeNull();
    expect(result).toBe(req);
  });

  it("preserves existing headers when adding If-Match", () => {
    const req = new Request("https://api.example.com/entities/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
    const result = addIfMatchHeader(req, '"abc"');
    expect(result.headers.get("Content-Type")).toBe("application/json");
    expect(result.headers.get("If-Match")).toBe('"abc"');
  });
});

describe("fetchVoid", () => {
  it("resolves void on 204 No Content", async () => {
    server.use(http.patch(TEST_URL, () => new HttpResponse(null, { status: 204 })));

    const apiFetch = createApiClient(noopSupplier);
    await expect(
      fetchVoid(apiFetch, new Request(TEST_URL, { method: "PATCH" })),
    ).resolves.toBeUndefined();
  });

  it("throws ProblemDetailError on non-2xx response", async () => {
    server.use(
      http.patch(TEST_URL, () =>
        HttpResponse.json(
          { status: 400, title: "Bad Request" },
          { status: 400, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const apiFetch = createApiClient(noopSupplier);
    await expect(
      fetchVoid(apiFetch, new Request(TEST_URL, { method: "PATCH" })),
    ).rejects.toBeInstanceOf(ProblemDetailError);
  });
});
