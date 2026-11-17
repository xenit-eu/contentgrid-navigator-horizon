import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { TypedFetch } from "@contentgrid/navigator-data";
import { createCollectionFixtureFetch } from "../test-fixtures/collection";
import { PROFILE_URL } from "../test-fixtures/item-detail";
import { preloadEntityItemSplit } from "./preload";

function setup() {
  const fixture = createCollectionFixtureFetch();
  const requests: string[] = [];
  const apiFetch = (async (input: Request | string | URL) => {
    requests.push(input instanceof Request ? input.url : String(input));
    return fixture.fetch(input);
  }) as unknown as TypedFetch;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { requests, apiFetch, queryClient };
}

describe("preloadEntityItemSplit", () => {
  it("preloads the list's profile and the selected item", async () => {
    const { requests, apiFetch, queryClient } = setup();

    await preloadEntityItemSplit(
      { queryClient, apiFetch, profileUrl: PROFILE_URL },
      "customer",
      "cust-001",
    );

    expect(requests.filter((url) => url.endsWith("/customers/cust-001"))).toHaveLength(1);
    expect(requests.filter((url) => url.endsWith("/profile/customers"))).toHaveLength(1);
  });

  it("preloads only the list's profile without an item id", async () => {
    const { requests, apiFetch, queryClient } = setup();

    await preloadEntityItemSplit({ queryClient, apiFetch, profileUrl: PROFILE_URL }, "customer");

    expect(requests.some((url) => url.includes("/customers/cust-"))).toBe(false);
    expect(requests.filter((url) => url.endsWith("/profile/customers"))).toHaveLength(1);
  });

  it("resolves without loading while the API client is absent", async () => {
    const { requests, queryClient } = setup();

    await expect(
      preloadEntityItemSplit(
        { queryClient, apiFetch: null, profileUrl: PROFILE_URL },
        "customer",
        "cust-001",
      ),
    ).resolves.toBeUndefined();
    expect(requests).toEqual([]);
  });

  it("resolves when a request fails", async () => {
    const { queryClient } = setup();
    const apiFetch = (() => Promise.reject(new Error("boom"))) as unknown as TypedFetch;

    await expect(
      preloadEntityItemSplit(
        { queryClient, apiFetch, profileUrl: PROFILE_URL },
        "customer",
        "cust-001",
      ),
    ).resolves.toBeUndefined();
  });
});
