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
import { EntityConfigurationOverview } from "./entity-configuration-overview";

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

  return render(<EntityConfigurationOverview onSelectEntity={onSelectEntity} />, {
    wrapper: Wrapper,
  });
}

afterEach(() => {
  localStorage.clear();
  useEntityDisplayPreferencesStore.setState({ overrides: {} });
  vi.mocked(useLoadedProfileEntities).mockReset();
});

describe("EntityConfigurationOverview", () => {
  it("shows loading skeletons while profiles are still loading", () => {
    mockProfiles([], true);
    const { container } = renderOverview();

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("shows an empty state when there are no entities", () => {
    mockProfiles([], false);
    renderOverview();

    expect(screen.getByText("No entities found")).toBeInTheDocument();
  });

  it("renders one card per discovered entity", () => {
    mockProfiles([makeProfile("invoice", "Invoices"), makeProfile("product", "Products")]);
    const { container } = renderOverview();

    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="entity-card"]')).toHaveLength(2);
  });

  it("calls onSelectEntity with the clicked entity's profile", async () => {
    const user = userEvent.setup();
    const onSelectEntity = vi.fn();
    mockProfiles([makeProfile("invoice", "Invoices")]);
    const { container } = renderOverview(onSelectEntity);

    await user.click(container.querySelector('[data-slot="entity-card"]')!);

    expect(onSelectEntity).toHaveBeenCalledTimes(1);
    expect(onSelectEntity.mock.calls[0][0].name).toBe("invoice");
  });

  it("calls onSelectEntity when the configure (gear) action is clicked", async () => {
    const user = userEvent.setup();
    const onSelectEntity = vi.fn();
    mockProfiles([makeProfile("invoice", "Invoices")]);
    renderOverview(onSelectEntity);

    await user.click(screen.getByRole("button", { name: "Configure Invoices" }));

    expect(onSelectEntity).toHaveBeenCalledTimes(1);
  });

  it("dismisses the color hint alert when closed", async () => {
    const user = userEvent.setup();
    mockProfiles([]);
    renderOverview();

    expect(screen.getByText(/Click on an entity icon/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText(/Click on an entity icon/)).not.toBeInTheDocument();
  });

  it("disables the apply-theme button when there are no entities", async () => {
    const user = userEvent.setup();
    mockProfiles([]);
    renderOverview();

    await user.click(screen.getByRole("button", { name: "Theme" }));
    await user.click(screen.getByRole("radio", { name: "Warm" }));

    expect(screen.getByRole("button", { name: "Apply theme" })).toBeDisabled();
  });

  it("cycles the selected theme's colors across every entity when applied", async () => {
    const user = userEvent.setup();
    mockProfiles([makeProfile("invoice", "Invoices"), makeProfile("product", "Products")]);
    renderOverview();

    await user.click(screen.getByRole("button", { name: "Theme" }));
    await user.click(screen.getByRole("radio", { name: "Warm" }));
    await user.click(screen.getByRole("button", { name: "Apply theme" }));

    const overrides = useEntityDisplayPreferencesStore.getState().overrides[PROFILE_URL];
    expect(overrides?.invoice?.color).toBeDefined();
    expect(overrides?.product?.color).toBeDefined();
    expect(overrides?.invoice?.color).not.toBe(overrides?.product?.color);
  });
});
