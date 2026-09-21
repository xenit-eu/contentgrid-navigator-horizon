import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItemCollection,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
  useEntityItemCollection,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { server } from "../../test-setup";
import { useEntityDisplayPreferencesStore } from "../preferences";
import { EntityItemCollectionTable } from "./entity-item-collection-table";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile/widgets`;
const COLLECTION_URL = `${API_URL}/widgets`;
const ITEM1_URL = `${COLLECTION_URL}/1`;
const ITEM2_URL = `${COLLECTION_URL}/2`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

const widgetProfileJson = {
  name: "widget",
  title: "Widget",
  _links: {
    self: { href: PROFILE_URL },
    describes: [
      { href: COLLECTION_URL, name: "collection" },
      { href: `${COLLECTION_URL}/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        name: "blueprint",
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        templated: true,
      },
    ],
  },
  _embedded: {
    "blueprint:attribute": [
      {
        name: "name",
        title: "Name",
        type: "string",
        readOnly: false,
        _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _templates: {
    default: { method: "HEAD", target: COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: COLLECTION_URL,
      properties: [
        { name: "name", type: "text" },
        {
          name: "_sort",
          type: "text",
          options: {
            minItems: 0,
            inline: [{ property: "name", direction: "asc", value: "name,asc", prompt: "Name A→Z" }],
          },
        },
      ],
    },
  },
};

function makeWidgetProfile(): ProfileEntity {
  return makeProfileEntity(widgetProfileJson, PROFILE_URL, "widget");
}

// Item 1 has a delete template (canDelete=true, ABAC grants delete); item 2 has none
// (canDelete=false) — this is what drives the per-row Delete button gating.
function collectionBody() {
  return {
    _embedded: {
      widget: [
        {
          id: "1",
          name: "Acme",
          _links: { self: { href: ITEM1_URL } },
          _templates: { delete: { method: "DELETE", target: ITEM1_URL, properties: [] } },
        },
        {
          id: "2",
          name: "Beta",
          _links: { self: { href: ITEM2_URL } },
        },
      ],
    },
    _links: {
      self: { href: COLLECTION_URL },
      next: { href: `${COLLECTION_URL}?_cursor=next-token` },
    },
    page: { size: 2, total_items_exact: 2 },
  };
}

function setupHandler() {
  server.use(http.get(COLLECTION_URL, () => HttpResponse.json(collectionBody())));
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  return Wrapper;
}

async function fetchCollection(): Promise<{
  profile: ProfileEntity;
  collection: EntityItemCollection;
  Wrapper: ReturnType<typeof makeWrapper>;
}> {
  setupHandler();
  const profile = makeWidgetProfile();
  const Wrapper = makeWrapper();
  const { result } = renderHook(() => useEntityItemCollection({ profileEntity: profile }), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return { profile, collection: result.current.data!, Wrapper };
}

afterEach(() => {
  localStorage.clear();
  useEntityDisplayPreferencesStore.setState({ overrides: {} });
});

describe("EntityItemCollectionTable", () => {
  it("renders a row per item plus the item-count footer", async () => {
    const { profile, collection, Wrapper } = await fetchCollection();
    render(<EntityItemCollectionTable profile={profile} collection={collection} />, {
      wrapper: Wrapper,
    });

    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2 items
    expect(screen.getByText("Showing 2 of 2 items")).toBeInTheDocument();
  });

  it("calls onEntityItemClick with the item when a row is clicked", async () => {
    const user = userEvent.setup();
    const { profile, collection, Wrapper } = await fetchCollection();
    const onEntityItemClick = vi.fn();
    render(
      <EntityItemCollectionTable
        profile={profile}
        collection={collection}
        onEntityItemClick={onEntityItemClick}
      />,
      { wrapper: Wrapper },
    );

    // Row order matches collection order — index 0 is the header row, 1 is item "1" (Acme).
    await user.click(screen.getAllByRole("row")[1]);
    expect(onEntityItemClick).toHaveBeenCalledOnce();
    expect(onEntityItemClick.mock.calls[0][0].id).toBe("1");
  });

  it("calls onEntityItemClick when the row's View action is used", async () => {
    const user = userEvent.setup();
    const { profile, collection, Wrapper } = await fetchCollection();
    const onEntityItemClick = vi.fn();
    render(
      <EntityItemCollectionTable
        profile={profile}
        collection={collection}
        onEntityItemClick={onEntityItemClick}
      />,
      { wrapper: Wrapper },
    );

    const viewButtons = screen.getAllByRole("button", { name: "View" });
    await user.click(viewButtons[0]);
    expect(onEntityItemClick).toHaveBeenCalledOnce();
  });

  it("only renders the Delete action for items the user is permitted to delete (ABAC)", async () => {
    const { profile, collection, Wrapper } = await fetchCollection();
    render(<EntityItemCollectionTable profile={profile} collection={collection} />, {
      wrapper: Wrapper,
    });

    // Item 1 (Acme) has a delete template; item 2 (Beta) does not.
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
  });

  it("deletes the item when the confirm dialog is accepted", async () => {
    const user = userEvent.setup();
    const { profile, collection, Wrapper } = await fetchCollection();
    let deleteCallCount = 0;
    server.use(
      http.delete(ITEM1_URL, () => {
        deleteCallCount++;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    render(<EntityItemCollectionTable profile={profile} collection={collection} />, {
      wrapper: Wrapper,
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete item")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteCallCount).toBe(1));
  });

  it("closes the confirm dialog without deleting when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const { profile, collection, Wrapper } = await fetchCollection();
    let deleteCallCount = 0;
    server.use(
      http.delete(ITEM1_URL, () => {
        deleteCallCount++;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    render(<EntityItemCollectionTable profile={profile} collection={collection} />, {
      wrapper: Wrapper,
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Delete item")).not.toBeInTheDocument();
    expect(deleteCallCount).toBe(0);
  });

  it("calls onSort with the next sort option when the sortable column header is clicked", async () => {
    const user = userEvent.setup();
    const { profile, collection, Wrapper } = await fetchCollection();
    const onSort = vi.fn();
    render(
      <EntityItemCollectionTable
        profile={profile}
        collection={collection}
        onSort={onSort}
        currentSort={undefined}
      />,
      { wrapper: Wrapper },
    );

    await user.click(screen.getByRole("button", { name: /Name/ }));
    expect(onSort).toHaveBeenCalledWith(
      expect.objectContaining({ value: "name,asc", property: "name" }),
    );
  });

  it("calls onPageChange with collection.nextHref when Next is clicked", async () => {
    const user = userEvent.setup();
    const { profile, collection, Wrapper } = await fetchCollection();
    const onPageChange = vi.fn();
    render(
      <EntityItemCollectionTable
        profile={profile}
        collection={collection}
        onPageChange={onPageChange}
      />,
      { wrapper: Wrapper },
    );

    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(onPageChange).toHaveBeenCalledWith(collection.nextHref);
  });

  it("disables Previous when the collection has no previous page", async () => {
    const { profile, collection, Wrapper } = await fetchCollection();
    render(
      <EntityItemCollectionTable
        profile={profile}
        collection={collection}
        onPageChange={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
  });
});
