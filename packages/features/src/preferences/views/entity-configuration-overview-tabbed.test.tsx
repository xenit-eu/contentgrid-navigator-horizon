import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { useEntityDisplayPreferencesStore } from "../entity-display-preferences-store";
import { EntityConfigurationOverviewTabbed } from "./entity-configuration-overview-tabbed";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useLoadedProfileEntities: vi.fn(),
  };
});

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;
const noopSupplier: AuthenticationTokenSupplier = async () => null;

function makeProfile(entityName: string, pluralTitle: string): ProfileEntity {
  return makeProfileEntity(
    {
      name: entityName,
      title: pluralTitle,
      _links: {
        self: { href: `${PROFILE_URL}/${entityName}s` },
        describes: [
          { href: `${API_URL}/${entityName}s`, name: "collection", title: pluralTitle },
          {
            href: `${API_URL}/${entityName}s/{id}`,
            name: "item",
            title: pluralTitle,
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
    `${PROFILE_URL}/${entityName}s`,
    entityName,
  );
}

function mockProfiles(profiles: readonly ProfileEntity[], isLoading = false) {
  vi.mocked(useLoadedProfileEntities).mockReturnValue({ profiles, isLoading });
}

function renderOverview(onSelectEntity: (profile: ProfileEntity) => void = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
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

  return render(<EntityConfigurationOverviewTabbed onSelectEntity={onSelectEntity} />, {
    wrapper: Wrapper,
  });
}

afterEach(() => {
  localStorage.clear();
  useEntityDisplayPreferencesStore.setState({ overrides: {} });
  vi.mocked(useLoadedProfileEntities).mockReset();
});

describe("EntityConfigurationOverviewTabbed", () => {
  it("renders nothing when there are no entities", () => {
    mockProfiles([]);
    const { container } = renderOverview();

    expect(container.querySelector('[data-slot="entity-card"]')).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("renders one tab per discovered entity, without an entity-card grid", () => {
    mockProfiles([makeProfile("invoice", "Invoices"), makeProfile("product", "Products")]);
    const { container } = renderOverview();

    expect(container.querySelectorAll('[data-slot="entity-card"]')).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Invoices" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Products" })).toBeInTheDocument();
  });

  it("selects the first entity's tab by default and renders its detail inline (no nested card)", () => {
    mockProfiles([makeProfile("invoice", "Invoices"), makeProfile("product", "Products")]);
    renderOverview();

    expect(screen.getByRole("tab", { name: "Invoices", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Products", selected: false })).toBeInTheDocument();
    // showInCard={false} on EntityConfigurationDetail — only the page-level EntityCard exists.
    expect(screen.queryByText("Configure display")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Name attribute" })).toBeInTheDocument();
  });

  it("switches the active tab and calls onSelectEntity when a different tab is clicked", async () => {
    const user = userEvent.setup();
    const onSelectEntity = vi.fn();
    mockProfiles([makeProfile("invoice", "Invoices"), makeProfile("product", "Products")]);
    renderOverview(onSelectEntity);

    await user.click(screen.getByRole("tab", { name: "Products" }));

    expect(screen.getByRole("tab", { name: "Products", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Invoices", selected: false })).toBeInTheDocument();
    expect(onSelectEntity).toHaveBeenCalledTimes(1);
    expect(onSelectEntity.mock.calls[0][0].name).toBe("product");
  });
});
