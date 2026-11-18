import { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEntityDisplayPreferencesStore } from "@contentgrid/features/preferences";
import {
  type ProfileEntity,
  useEntityItemCollection,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { PROFILE_URL } from "../test-fixtures/item-detail";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityConfigurationDetailView } from "./entity-configuration-detail-view";

// The previews are the real child views; here they are stand-ins that show the props they got.
vi.mock("../entity-item-detail", () => ({
  EntityItemDetailView: (props: object) => (
    <div data-testid="item-detail-view">{JSON.stringify(props)}</div>
  ),
}));
const collectionViewMounts = vi.hoisted(() => ({ count: 0 }));
vi.mock("../entity-item-collection", () => ({
  EntityItemCollectionView: function CollectionViewStub(props: object) {
    useEffect(() => {
      collectionViewMounts.count += 1;
    }, []);
    return <div data-testid="collection-view">{JSON.stringify(props)}</div>;
  },
}));

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return { ...actual, useLoadedProfileEntities: vi.fn(), useEntityItemCollection: vi.fn() };
});

const API_URL = "https://api.example.com";

function makeInvoiceProfile(): ProfileEntity {
  return makeProfile("invoice", "Invoices");
}

function makeProfile(name: string, plural: string): ProfileEntity {
  return makeProfileEntity(
    {
      name,
      title: plural.slice(0, -1),
      _links: {
        self: { href: `${API_URL}/profile/${name}s` },
        describes: [
          { href: `${API_URL}/${name}s`, name: "collection", title: plural },
          {
            href: `${API_URL}/${name}s/{id}`,
            name: "item",
            title: plural.slice(0, -1),
            templated: true,
          },
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
            name: "id",
            title: "ID",
            type: "string",
            readOnly: true,
            _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
            _links: {},
          },
        ],
        "blueprint:relation": [],
      },
      _templates: {},
    },
    `${API_URL}/profile/${name}s`,
    name,
  );
}

function mockProfiles(profiles: readonly ProfileEntity[], isLoading = false) {
  vi.mocked(useLoadedProfileEntities).mockReturnValue({
    profiles,
    isLoading,
    error: null,
  } as unknown as ReturnType<typeof useLoadedProfileEntities>);
}

function mockFirstPage(items: readonly { id: string }[]) {
  vi.mocked(useEntityItemCollection).mockReturnValue({
    isPending: false,
    isError: false,
    isSuccess: true,
    data: { items },
  } as unknown as ReturnType<typeof useEntityItemCollection>);
}

function renderView(props: Partial<Parameters<typeof EntityConfigurationDetailView>[0]> = {}) {
  const harness = createItemDetailTestHarness();
  render(<EntityConfigurationDetailView entityName="invoice" {...props} />, {
    wrapper: harness.Wrapper,
  });
  return harness;
}

afterEach(() => {
  vi.mocked(useLoadedProfileEntities).mockReset();
  vi.mocked(useEntityItemCollection).mockReset();
  localStorage.clear();
});

describe("EntityConfigurationDetailView", () => {
  it("shows the entity's title, eyebrow and description under a Settings › entity trail", () => {
    mockProfiles([makeInvoiceProfile()]);
    mockFirstPage([]);
    renderView();

    expect(screen.getByRole("heading", { level: 1, name: "Invoices" })).toBeInTheDocument();
    expect(screen.getByText("Configure display")).toBeInTheDocument();
    expect(screen.getByText(/how Invoices are rendered./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(document.querySelector("[aria-current='page']")).toHaveTextContent("Invoices");
  });

  it("goes back to the settings through navigation from Close and the Settings crumb", async () => {
    mockProfiles([makeInvoiceProfile()]);
    mockFirstPage([]);
    const { recording } = renderView();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("link", { name: "Settings" }));

    expect(recording.calls).toEqual([
      { method: "openSettings", args: [] },
      { method: "openSettings", args: [] },
    ]);
  });

  it("opens another entity's configuration from the entity selector in the toolbar", async () => {
    mockProfiles([makeInvoiceProfile(), makeProfile("customer", "Customers")]);
    mockFirstPage([]);
    const { recording } = renderView();

    // The toolbar's selector comes before the settings form's comboboxes.
    await userEvent.click(screen.getAllByRole("combobox")[0]);
    await userEvent.click(await screen.findByRole("option", { name: /customer/i }));

    expect(recording.calls).toEqual([{ method: "openEntityConfiguration", args: ["customer"] }]);
  });

  it("previews the first item's detail page, without its toolbar", () => {
    mockProfiles([makeInvoiceProfile()]);
    mockFirstPage([{ id: "inv-1" }, { id: "inv-2" }]);
    renderView();

    expect(JSON.parse(screen.getByTestId("item-detail-view").textContent ?? "")).toEqual({
      entityName: "invoice",
      itemId: "inv-1",
      toolbar: false,
    });
  });

  it("asks for an item when the entity has none to preview", () => {
    mockProfiles([makeInvoiceProfile()]);
    mockFirstPage([]);
    renderView();

    expect(screen.getByText(/Please create a .* item to enable the preview/)).toBeInTheDocument();
    expect(screen.queryByTestId("item-detail-view")).not.toBeInTheDocument();
  });

  it("previews the collection page, without its toolbar", async () => {
    mockProfiles([makeInvoiceProfile()]);
    mockFirstPage([]);
    renderView();

    await userEvent.click(screen.getByRole("tab", { name: "Collection Preview" }));

    expect(JSON.parse(screen.getByTestId("collection-view").textContent ?? "")).toEqual({
      entityName: "invoice",
      toolbar: false,
    });
  });

  it("reloads the collection preview when the visible columns change", async () => {
    const profile = makeInvoiceProfile();
    mockProfiles([profile]);
    mockFirstPage([]);
    renderView();
    await userEvent.click(screen.getByRole("tab", { name: "Collection Preview" }));
    const mountsBefore = collectionViewMounts.count;

    act(() => {
      useEntityDisplayPreferencesStore
        .getState()
        .setOverride(PROFILE_URL, profile.name, { visibleColumns: ["id", "total"] });
    });

    expect(collectionViewMounts.count).toBe(mountsBefore + 1);
  });

  it("shows the display settings next to the previews", () => {
    mockProfiles([makeInvoiceProfile()]);
    mockFirstPage([]);
    renderView();

    expect(screen.getByRole("combobox", { name: "Name attribute" })).toBeInTheDocument();
  });

  it("draws no toolbar when hidden", () => {
    mockProfiles([makeInvoiceProfile()]);
    mockFirstPage([]);
    renderView({ toolbar: false });

    expect(screen.getByRole("heading", { level: 1, name: "Invoices" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("shows not-found for an unknown entity", () => {
    mockProfiles([makeInvoiceProfile()]);
    renderView({ entityName: "nope" });

    expect(screen.getByText(/No profile for entity "nope"/)).toBeInTheDocument();
  });
});
