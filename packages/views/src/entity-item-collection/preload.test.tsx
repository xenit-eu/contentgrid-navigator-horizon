import { QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TypedFetch } from "@contentgrid/navigator-data";
import { createCollectionFixtureFetch } from "../test-fixtures/collection";
import { PROFILE_URL } from "../test-fixtures/item-detail";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemCollectionView } from "./entity-item-collection-view";
import { preloadEntityItemCollection } from "./preload";

function setup() {
  const fixture = createCollectionFixtureFetch();
  const requests: string[] = [];
  const apiFetch = (async (input: Request | string | URL) => {
    requests.push(input instanceof Request ? input.url : String(input));
    return fixture.fetch(input);
  }) as unknown as TypedFetch;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const profileRequests = () => requests.filter((url) => url.endsWith("/profile/customers"));
  return { requests, profileRequests, apiFetch, queryClient };
}

describe("preloadEntityItemCollection", () => {
  it("fills the cache so the view's first render has no profile loading state and no second profile request", async () => {
    const { profileRequests, apiFetch, queryClient } = setup();
    await preloadEntityItemCollection(
      { queryClient, apiFetch, profileUrl: PROFILE_URL },
      "customer",
    );
    expect(profileRequests()).toHaveLength(1);

    const { Wrapper } = createItemDetailTestHarness({ queryClient, fetchFn: apiFetch });
    render(<EntityItemCollectionView entityName="customer" />, { wrapper: Wrapper });

    // Synchronously after the first render: the toolbar already knows the entity, so the profile
    // came from the cache. Only the table's own page request is pending.
    expect(document.querySelector("[aria-current='page']")).toHaveTextContent("Customers");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(await screen.findAllByText("Acme Corp")).not.toHaveLength(0);
    expect(profileRequests()).toHaveLength(1);
  });

  it("resolves without loading while the API client is absent", async () => {
    const { requests, queryClient } = setup();

    await expect(
      preloadEntityItemCollection(
        { queryClient, apiFetch: null, profileUrl: PROFILE_URL },
        "customer",
      ),
    ).resolves.toBeUndefined();
    expect(requests).toEqual([]);
  });

  it("resolves when the fetch fails", async () => {
    const { queryClient } = setup();
    const apiFetch = (() => Promise.reject(new Error("boom"))) as unknown as TypedFetch;

    await expect(
      preloadEntityItemCollection({ queryClient, apiFetch, profileUrl: PROFILE_URL }, "customer"),
    ).resolves.toBeUndefined();
  });
});
