import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TypedFetch } from "@contentgrid/navigator-data";
import {
  CUSTOMER_COLLECTION_URL,
  CUSTOMER_ITEM_URL,
  PROFILE_URL,
  createFixtureFetch,
} from "../test-fixtures/item-detail";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import type { ViewTarget } from "../types";
import { EntityItemDetailView } from "./entity-item-detail-view";
import { preload } from "./preload";

// The item's name shows in its reference header and again in its attribute table.
const findItemName = async () => (await screen.findAllByText("Acme Corp"))[0];

const target: ViewTarget = { kind: "name", entityName: "customer", itemId: "cust-001" };

const setup = createItemDetailTestHarness;

describe("EntityItemDetailView", () => {
  it("shows the item under a Home, collection, item breadcrumb", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView target={target} />, { wrapper: Wrapper });

    // A deterministic `hrefFor` is always given by the recording navigation, so breadcrumbs render
    // as real links, not buttons (see `NavigationLink`).
    expect(await screen.findByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customers" })).toBeInTheDocument();
    expect(screen.getByText("cust-001", { selector: "[aria-current='page']" })).toBeInTheDocument();
    expect(await findItemName()).toBeInTheDocument();
  });

  it("opens home and the collection through the navigation object", async () => {
    const { Wrapper, recording } = setup();
    render(<EntityItemDetailView target={target} />, { wrapper: Wrapper });

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
    render(<EntityItemDetailView target={target} hideToolbar />, { wrapper: Wrapper });

    expect(await findItemName()).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /breadcrumb/i })).not.toBeInTheDocument();
  });

  it("shows a loading state first, with the toolbar once the profile is known", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView target={target} />, { wrapper: Wrapper });
    expect(screen.getByRole("status")).toBeInTheDocument();
    await findItemName();
  });

  it("shows the problem for an item that fails, keeping the toolbar", async () => {
    const fixture = createFixtureFetch();
    let itemRequests = 0;
    const fetchFn = async (input: Request) => {
      if (input.url === CUSTOMER_ITEM_URL) itemRequests++;
      return input.url === CUSTOMER_ITEM_URL
        ? new Response(
            JSON.stringify({
              type: "https://contentgrid.cloud/problems/not-found/entity-item",
              title: "Entity item not found",
              status: 404,
            }),
            { status: 404, headers: { "Content-Type": "application/problem+json" } },
          )
        : fixture.fetch(input);
    };
    const { Wrapper } = setup({ fetchFn });
    render(<EntityItemDetailView target={target} />, { wrapper: Wrapper });

    expect(
      await screen.findByText("Entity item not found", {}, { timeout: 15000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customers" })).toBeInTheDocument();
    // Same as before the view existed: the item query retries three times (`useEntityItem` under
    // the apps' default query client) before the not-found problem is shown.
    expect(itemRequests).toBe(4);
  }, 20000);

  it("shows not-found for an unknown entity, without a toolbar", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView target={{ kind: "name", entityName: "nope", itemId: "1" }} />, {
      wrapper: Wrapper,
    });

    expect(await screen.findByText(/No entity profile named "nope"/)).toBeInTheDocument();
    // No profile is ever resolved for an unknown entity name, so there is nothing to draw the
    // toolbar's breadcrumbs from — unlike the "collection target" case below.
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
  });

  it("says so when the target addresses a collection, keeping the toolbar", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView target={{ kind: "name", entityName: "customer" }} />, {
      wrapper: Wrapper,
    });
    expect(await screen.findByText("Not an item")).toBeInTheDocument();
    // The profile IS known here (unlike the unknown-entity case above), so the view keeps its
    // breadcrumb toolbar around the error instead of filling the whole view with it.
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customers" })).toBeInTheDocument();
  });

  it("opens an item given by link", async () => {
    const { Wrapper } = setup();
    render(<EntityItemDetailView target={{ kind: "url", href: CUSTOMER_ITEM_URL }} />, {
      wrapper: Wrapper,
    });
    expect(await findItemName()).toBeInTheDocument();
  });
});

describe("preload", () => {
  it("fills the cache so the view renders the item without a loading state", async () => {
    const { Wrapper, queryClient, apiFetch, counts } = setup();
    await preload({ queryClient, apiFetch, profileUrl: PROFILE_URL }, target, undefined);
    expect(counts.item).toBe(1);

    render(<EntityItemDetailView target={target} />, { wrapper: Wrapper });
    // Resolved from cache on the first render; the item feature's own `useEntityItem` may still
    // revalidate in the background (its default staleTime is 0), which is not the view's request.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect((await findItemName()).textContent).toBe("Acme Corp");
  });

  it("returns without loading while the API client is absent", async () => {
    const { queryClient, counts } = setup();
    await expect(
      preload({ queryClient, apiFetch: null, profileUrl: null }, target, undefined),
    ).resolves.toBeUndefined();
    expect(counts.item).toBe(0);
  });

  it("resolves when a request fails", async () => {
    const { queryClient } = setup();
    const failing = vi.fn().mockRejectedValue(new Error("network down")) as unknown as TypedFetch;
    await expect(
      preload({ queryClient, apiFetch: failing, profileUrl: PROFILE_URL }, target, undefined),
    ).resolves.toBeUndefined();
  });
});

// Unused import guard for fixtures that document the shape.
void CUSTOMER_COLLECTION_URL;
