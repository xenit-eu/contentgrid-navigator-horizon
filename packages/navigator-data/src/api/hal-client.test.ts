import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { HalObject, HalSlice } from "@contentgrid/hal";
import { ProblemDetailError } from "@contentgrid/problem-details";
import { server } from "../../test-setup";
import { type AuthenticationTokenSupplier, createApiClient } from "./client";
import { fetchHal, fetchHalSlice } from "./hal-client";

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
    const { object } = await fetchHal(apiFetch, TEST_URL);

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
    const { etag } = await fetchHal(apiFetch, TEST_URL);

    expect(etag).toBe('"abc123"');
  });

  it("returns null etag when the server sends no ETag header", async () => {
    server.use(
      http.get(TEST_URL, () =>
        HttpResponse.json({ id: "1", _links: { self: { href: TEST_URL } } }),
      ),
    );

    const apiFetch = createApiClient(noopSupplier);
    const { etag } = await fetchHal(apiFetch, TEST_URL);

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
    await expect(fetchHal(apiFetch, TEST_URL)).rejects.toBeInstanceOf(ProblemDetailError);
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
    await expect(fetchHal(apiFetch, TEST_URL)).rejects.toBeInstanceOf(ProblemDetailError);
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
    const result = await fetchHalSlice(apiFetch, COLLECTION_URL);

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
    await expect(fetchHalSlice(apiFetch, COLLECTION_URL)).rejects.toBeInstanceOf(
      ProblemDetailError,
    );
  });
});
