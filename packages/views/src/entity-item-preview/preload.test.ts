import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { TypedFetch } from "@contentgrid/navigator-data";
import { PROFILE_URL, createFixtureFetch } from "../test-fixtures/item-detail";
import { preloadEntityItemPreview } from "./preload";

function setup() {
  const fixture = createFixtureFetch();
  const requests: string[] = [];
  const apiFetch = (async (input: Request | string | URL) => {
    requests.push(input instanceof Request ? input.url : String(input));
    return fixture.fetch(input);
  }) as unknown as TypedFetch;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { requests, apiFetch, queryClient };
}

describe("preloadEntityItemPreview", () => {
  it("preloads the profile and the item", async () => {
    const { requests, apiFetch, queryClient } = setup();

    await preloadEntityItemPreview(
      { queryClient, apiFetch, profileUrl: PROFILE_URL },
      "customer",
      "cust-001",
    );

    expect(requests.filter((url) => url.endsWith("/profile/customers"))).toHaveLength(1);
    expect(requests.filter((url) => url.endsWith("/customers/cust-001"))).toHaveLength(1);
  });

  it("resolves without loading while the API client is absent", async () => {
    const { requests, queryClient } = setup();

    await expect(
      preloadEntityItemPreview(
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
      preloadEntityItemPreview(
        { queryClient, apiFetch, profileUrl: PROFILE_URL },
        "customer",
        "cust-001",
      ),
    ).resolves.toBeUndefined();
  });
});
