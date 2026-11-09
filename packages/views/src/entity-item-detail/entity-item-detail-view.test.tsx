import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TypedFetch } from "@contentgrid/navigator-data";
import { CUSTOMER_ITEM_URL, PROFILE_URL, createFixtureFetch } from "../test-fixtures/item-detail";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemDetailView } from "./entity-item-detail-view";
import { preloadEntityItemDetail } from "./preload";

// The item's name shows in its reference header and again in its attribute table.
const findItemName = async () => (await screen.findAllByText("Acme Corp"))[0];

// The item crumb is the breadcrumb's current page, drawn as the item's reference once it loaded.
const currentCrumbs = () => document.querySelectorAll("[aria-current='page']");

const entityName = "customer";
const itemId = "cust-001";

const setup = createItemDetailTestHarness;

describe("EntityItemDetailView", () => {
  it("shows the item under a Home, collection, item breadcrumb", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });

    // A deterministic `hrefFor` is always given by the recording navigation, so breadcrumbs render
    // as real links, not buttons (see `NavigationLink`).
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Customers" })).toBeInTheDocument();
    expect(await findItemName()).toBeInTheDocument();
    expect(currentCrumbs()[0]).toHaveTextContent("Acme Corp");
  });

  it("opens home and the collection through the navigation object", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });

    await findItemName();
    await userEvent.click(screen.getByRole("link", { name: "Home" }));
    await userEvent.click(screen.getByRole("link", { name: "Customers" }));

    expect(recording.calls).toEqual([
      { method: "openHome", args: [] },
      { method: "openEntityItemCollection", args: ["customer"] },
    ]);
  });

  it("draws no toolbar when hidden", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} toolbar={false} />, {
      wrapper: Wrapper,
    });

    expect(await findItemName()).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /breadcrumb/i })).not.toBeInTheDocument();
  });

  it("shows a loading state first, with the toolbar once the profile is known", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });
    expect(screen.getByRole("status")).toBeInTheDocument();
    await findItemName();
  });

  it("shows the problem for an item that fails, keeping the toolbar", async () => {
    const fixture = createFixtureFetch();
    const fetchFn = async (input: Request) =>
      input.url === CUSTOMER_ITEM_URL
        ? new Response(
            JSON.stringify({
              type: "https://contentgrid.cloud/problems/not-found/entity-item",
              title: "Entity item not found",
              status: 404,
            }),
            { status: 404, headers: { "Content-Type": "application/problem+json" } },
          )
        : fixture.fetch(input);
    const { Wrapper } = setup({ fetchFn });
    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });

    expect(await screen.findByText("Entity item not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customers" })).toBeInTheDocument();
  });

  it("shows not-found for an unknown entity, with only the Home crumb", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView entityName="nope" itemId="1" />, { wrapper: Wrapper });

    expect(await screen.findByText(/No profile for entity "nope"/)).toBeInTheDocument();
    // No profile is ever resolved for an unknown entity name, so there is no collection or item
    // crumb to draw.
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(currentCrumbs()).toHaveLength(0);
  });
});

describe("EntityItemDetailView by link", () => {
  it("finds the profile through its describes links and shows the item", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView itemUrl={CUSTOMER_ITEM_URL} />, { wrapper: Wrapper });

    expect(await findItemName()).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customers" })).toBeInTheDocument();
    expect(currentCrumbs()[0]).toHaveTextContent("Acme Corp");
  });

  it("shares one cached item when opened by name and by link", async () => {
    const { Wrapper, queryClient } = setup();
    render(
      <>
        <EntityItemDetailView entityName={entityName} itemId={itemId} />
        <EntityItemDetailView itemUrl={CUSTOMER_ITEM_URL} />
      </>,
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(currentCrumbs()).toHaveLength(2));
    const itemQueries = queryClient
      .getQueryCache()
      .findAll({ predicate: (query) => query.queryKey[0] === "EntityItem" });
    expect(itemQueries).toHaveLength(1);
  });

  it("shows not-found for a link no profile describes, with only the Home crumb", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView itemUrl="https://api.example.com/unknown/1" />, {
      wrapper: Wrapper,
    });

    expect(await screen.findByText(/No profile describes/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Customers" })).not.toBeInTheDocument();
  });
});

describe("preloadEntityItemDetail", () => {
  it("fills the cache so the view renders the item without a loading state", async () => {
    const { Wrapper, queryClient, apiFetch, counts } = setup();
    await preloadEntityItemDetail(
      { queryClient, apiFetch, profileUrl: PROFILE_URL },
      entityName,
      itemId,
    );
    expect(counts.item).toBe(1);

    render(<EntityItemDetailView entityName={entityName} itemId={itemId} />, { wrapper: Wrapper });
    // Resolved from cache on the first render; the item feature's own `useEntityItem` may still
    // revalidate in the background (its default staleTime is 0), which is not the view's request.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect((await findItemName()).textContent).toBe("Acme Corp");
  });

  it("returns without loading while the API client is absent", async () => {
    const { queryClient, counts } = setup();
    await expect(
      preloadEntityItemDetail(
        { queryClient, apiFetch: null, profileUrl: null },
        entityName,
        itemId,
      ),
    ).resolves.toBeUndefined();
    expect(counts.item).toBe(0);
  });

  it("resolves when a request fails", async () => {
    const { queryClient } = setup();
    const failing = vi.fn().mockRejectedValue(new Error("network down")) as unknown as TypedFetch;
    await expect(
      preloadEntityItemDetail(
        { queryClient, apiFetch: failing, profileUrl: PROFILE_URL },
        entityName,
        itemId,
      ),
    ).resolves.toBeUndefined();
  });
});
