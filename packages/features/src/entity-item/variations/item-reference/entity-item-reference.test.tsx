import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItem,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
  useEntityItemCollection,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { server } from "../../../../test-setup";
import { useEntityDisplayPreferencesStore } from "../../../preferences";
import { EntityItemReference, EntityItemReferenceLoading } from "./entity-item-reference";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile/widgets`;
const COLLECTION_URL = `${API_URL}/widgets`;

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
      {
        name: "email",
        title: "Email",
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
    search: { method: "GET", target: COLLECTION_URL, properties: [] },
  },
};

function makeWidgetProfile() {
  return makeProfileEntity(widgetProfileJson, PROFILE_URL, "widget");
}

const LONG_NAME = "N".repeat(130);
const LONG_EMAIL = `${"e".repeat(130)}@example.com`;
const LONG_ID = "i".repeat(60);

// Items 2 and 4 deliberately omit "name" — the profile still declares it, but the response has no
// value for it — so `item.findAttribute("name")` returns undefined and EntityItemReference
// falls back to `item.id` as the title.
function collectionBody() {
  return {
    _embedded: {
      widget: [
        {
          id: "1",
          name: "Acme",
          email: "hello@acme.com",
          _links: { self: { href: `${COLLECTION_URL}/1` } },
        },
        {
          id: "2",
          email: "bob@example.com",
          _links: { self: { href: `${COLLECTION_URL}/2` } },
        },
        {
          id: "3",
          name: LONG_NAME,
          email: LONG_EMAIL,
          _links: { self: { href: `${COLLECTION_URL}/3` } },
        },
        {
          id: LONG_ID,
          email: "carol@example.com",
          _links: { self: { href: `${COLLECTION_URL}/${LONG_ID}` } },
        },
      ],
    },
    _links: { self: { href: COLLECTION_URL } },
    page: { size: 4, total_items_exact: 4 },
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

async function fetchItems(): Promise<[EntityItem, EntityItem, EntityItem, EntityItem]> {
  setupHandler();
  const profile = makeWidgetProfile();
  const Wrapper = makeWrapper();
  const { result } = renderHook(() => useEntityItemCollection({ profileEntity: profile }), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const [itemA, itemB, itemC, itemD] = result.current.data!.items;
  return [itemA, itemB, itemC, itemD];
}

afterEach(() => {
  localStorage.clear();
  useEntityDisplayPreferencesStore.setState({ overrides: {} });
});

describe("EntityItemReference", () => {
  it("renders the heuristic name attribute as the title, with no subtitle", async () => {
    const [itemA] = await fetchItems();
    render(<EntityItemReference item={itemA} />, { wrapper: makeWrapper() });

    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.queryByText("hello@acme.com")).not.toBeInTheDocument();
  });

  it("falls back to item.id as the title when the name attribute has no value on this item", async () => {
    const [, itemB] = await fetchItems();
    render(<EntityItemReference item={itemB} />, { wrapper: makeWrapper() });

    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("renders the subtitle attribute when one is configured and the item has a value", async () => {
    const [itemA] = await fetchItems();
    useEntityDisplayPreferencesStore
      .getState()
      .setOverride(PROFILE_URL, "widget", { subtitleAttribute: "email" });

    render(<EntityItemReference item={itemA} />, { wrapper: makeWrapper() });

    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("hello@acme.com")).toBeInTheDocument();
  });

  it("truncates a long title and subtitle to 120 characters", async () => {
    const [, , itemC] = await fetchItems();
    useEntityDisplayPreferencesStore
      .getState()
      .setOverride(PROFILE_URL, "widget", { subtitleAttribute: "email" });

    render(<EntityItemReference item={itemC} />, { wrapper: makeWrapper() });

    expect(await screen.findByText(`${LONG_NAME.slice(0, 120)}…`)).toBeInTheDocument();
    expect(screen.getByText(`${LONG_EMAIL.slice(0, 120)}…`)).toBeInTheDocument();
    // The full value is only there for screen readers.
    expect(screen.getByText(LONG_EMAIL)).toHaveClass("sr-only");
  });

  it("truncates the title at titleMaxCharLength, with the full title on hover", async () => {
    const [, , itemC] = await fetchItems();
    render(<EntityItemReference item={itemC} titleMaxCharLength={40} />, {
      wrapper: makeWrapper(),
    });

    await userEvent.hover(await screen.findByText(`${LONG_NAME.slice(0, 40)}…`));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(LONG_NAME);
  });

  it("truncates a long id at titleMaxCharLength when it stands in for the title", async () => {
    const [, , , itemD] = await fetchItems();
    render(<EntityItemReference item={itemD} titleMaxCharLength={40} />, {
      wrapper: makeWrapper(),
    });

    expect(await screen.findByText(`${LONG_ID.slice(0, 40)}…`)).toBeInTheDocument();
  });

  it("renders only the title as plain text with titleOnly, even when a subtitle is configured", async () => {
    const [itemA] = await fetchItems();
    useEntityDisplayPreferencesStore
      .getState()
      .setOverride(PROFILE_URL, "widget", { subtitleAttribute: "email" });

    const { container } = render(<EntityItemReference item={itemA} titleOnly />, {
      wrapper: makeWrapper(),
    });

    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.queryByText("hello@acme.com")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders as a clickable button and calls onClick", async () => {
    const user = userEvent.setup();
    const [itemA] = await fetchItems();
    let clicked = false;
    render(<EntityItemReference item={itemA} onClick={() => (clicked = true)} />, {
      wrapper: makeWrapper(),
    });

    const button = await screen.findByRole("button");
    await user.click(button);
    expect(clicked).toBe(true);
  });

  it("marks itself selected via data-selected", async () => {
    const [itemA] = await fetchItems();
    render(<EntityItemReference item={itemA} onClick={() => {}} selected />, {
      wrapper: makeWrapper(),
    });

    const button = await screen.findByRole("button");
    expect(button).toHaveAttribute("data-selected", "true");
  });
});

describe("EntityItemReferenceLoading", () => {
  it("renders a Loading title", () => {
    render(<EntityItemReferenceLoading />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("is not clickable", () => {
    render(<EntityItemReferenceLoading />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
