import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { server } from "../../../../test-setup";
import { EntityItemPreview } from "./entity-item-preview";

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
    ],
    "blueprint:relation": [],
  },
  _templates: {
    default: { method: "HEAD", target: COLLECTION_URL, properties: [] },
    search: { method: "GET", target: COLLECTION_URL, properties: [] },
  },
};

function makeWidgetProfile(): ProfileEntity {
  return makeProfileEntity(widgetProfileJson, PROFILE_URL, "widget");
}

function renderPreview(profile: ProfileEntity) {
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

  return render(<EntityItemPreview profile={profile} />, { wrapper: Wrapper });
}

describe("EntityItemPreview", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a loading state while the collection is pending", () => {
    server.use(http.get(COLLECTION_URL, () => new Promise(() => {})));
    renderPreview(makeWidgetProfile());
    expect(screen.getByText("Loading preview…")).toBeInTheDocument();
  });

  it("shows an error alert when the collection fetch fails", async () => {
    // fetchByUrlQuery hardcodes retry: 3 with backoff — advance fake timers to flush it rather
    // than waiting out real backoff delays (see packages/navigator-data/CLAUDE.md). Asserts
    // synchronously (not screen.findBy*) once timers are flushed — findBy's own real-time
    // polling would itself stall forever while fake timers are still active.
    vi.useFakeTimers();
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json(
          { status: 500, title: "Internal Server Error" },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    renderPreview(makeWidgetProfile());

    await vi.runAllTimersAsync();

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("prompts to create an item when the collection is empty", async () => {
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _embedded: { widget: [] },
          _links: { self: { href: COLLECTION_URL } },
          page: { size: 0, total_items_exact: 0 },
        }),
      ),
    );
    renderPreview(makeWidgetProfile());
    expect(
      await screen.findByText("Please create a widget item to enable the preview"),
    ).toBeInTheDocument();
  });

  it("renders the reference and attributes of the first item when the collection has items", async () => {
    server.use(
      http.get(COLLECTION_URL, () =>
        HttpResponse.json({
          _embedded: {
            widget: [
              { id: "1", name: "Acme", _links: { self: { href: `${COLLECTION_URL}/1` } } },
              { id: "2", name: "Beta", _links: { self: { href: `${COLLECTION_URL}/2` } } },
            ],
          },
          _links: { self: { href: COLLECTION_URL } },
          page: { size: 2, total_items_exact: 2 },
        }),
      ),
    );
    renderPreview(makeWidgetProfile());

    // "Acme" appears twice: once as the reference title, once as the "name" attribute row.
    // Only the FIRST item's reference/attributes render — "Beta" (second item) never appears.
    expect((await screen.findAllByText("Acme")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });
});
