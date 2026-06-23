import type { ReactNode } from "react";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAuthResult, UseSelectedEntityResult } from "@contentgrid/navigator-data";
import { useAppAuth, useSelectedEntity } from "@contentgrid/navigator-data";
import type { ProfileEntityType } from "@contentgrid/navigator-data";
import type { Entity } from "@contentgrid/ui";
import { routeTree } from "../routeTree.gen";

vi.mock("@contentgrid/navigator-data", () => ({
  useAppAuth: vi.fn(),
  useSelectedEntity: vi.fn(),
  NavigatorDataProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@contentgrid/ui", () => ({
  BrandingHeader: ({ actions }: { actions?: ReactNode }) => (
    <header role="banner">{actions}</header>
  ),
  EntitySelector: ({
    entities,
    selectedEntity,
    onSelect,
  }: {
    entities: Entity[];
    selectedEntity?: Entity;
    onSelect: (e: Entity) => void;
  }) => (
    <select
      data-testid="entity-selector"
      data-selected={selectedEntity?.name ?? ""}
      value={selectedEntity?.name ?? ""}
      onChange={(ev) => {
        const entity = entities.find((e) => e.name === ev.target.value);
        if (entity) onSelect(entity);
      }}
    >
      {entities.map((e) => (
        <option key={e.name} value={e.name}>
          {e.title}
        </option>
      ))}
    </select>
  ),
  SignInGate: ({ onSignIn }: { onSignIn: () => void }) => (
    <button onClick={onSignIn}>Sign in</button>
  ),
}));

vi.mock("@contentgrid/features/entity-list", async () => {
  const router =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    EntityListLayout: () => <router.Outlet />,
    EntityOverviewPage: () => <div data-testid="entity-overview" />,
    EntityDetailPage: () => {
      const { entity } = router.useParams({ strict: false }) as { entity: string };
      return <div data-testid="entity-detail" data-entity={entity} />;
    },
    EntityItemDetailPage: () => <div data-testid="entity-item-detail" />,
    entityDetailSearchValidator: (s: Record<string, unknown>) => s,
  };
});

afterEach(cleanup);

const INVOICE = { name: "invoice", title: "Invoice" } as unknown as ProfileEntityType;
const CUSTOMER = { name: "customer", title: "Customer" } as unknown as ProfileEntityType;

function makeAuthResult(overrides: Record<string, unknown> = {}): AppAuthResult {
  return {
    auth: {
      isLoading: false,
      isAuthenticated: true,
      user: null,
      error: undefined,
      signinRedirect: vi.fn(),
      ...overrides,
    },
    apiFetch: vi.fn(),
    profileUrl: "https://api.example.com/profile",
  } as unknown as AppAuthResult;
}

function makeEntityResult(
  overrides: Partial<UseSelectedEntityResult> = {},
): UseSelectedEntityResult {
  return {
    entities: [],
    selectedEntity: null,
    setSelectedEntity: vi.fn(),
    isPending: false,
    isError: false,
    ...overrides,
  };
}

function renderRouter(initialPath = "/") {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(<RouterProvider router={router} />);
}

describe("RootComponent — auth states", () => {
  beforeEach(() => {
    vi.mocked(useSelectedEntity).mockReturnValue(makeEntityResult());
  });

  it("renders nothing while auth is loading", () => {
    vi.mocked(useAppAuth).mockReturnValue(
      makeAuthResult({ isLoading: true, isAuthenticated: false }),
    );
    const { container } = renderRouter();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the user token is expired and there is no error", () => {
    vi.mocked(useAppAuth).mockReturnValue(
      makeAuthResult({ user: { expired: true }, error: undefined }),
    );
    const { container } = renderRouter();
    expect(container.firstChild).toBeNull();
  });

  it("renders SignInGate when user is not authenticated", async () => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult({ isAuthenticated: false }));
    renderRouter();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    });
  });

  it("renders the app header when authenticated", async () => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult());
    renderRouter();
    await waitFor(() => {
      expect(screen.getByRole("banner")).toBeInTheDocument();
    });
  });
});

describe("AppLayout — entity routing", () => {
  beforeEach(() => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult());
    vi.mocked(useSelectedEntity).mockReturnValue(makeEntityResult());
  });

  it("renders entity overview when no entity is in the URL", async () => {
    renderRouter("/");
    await waitFor(() => {
      expect(screen.getByTestId("entity-overview")).toBeInTheDocument();
    });
  });

  it("renders entity detail when entity path param is in the URL", async () => {
    renderRouter("/invoice");
    await waitFor(() => {
      expect(screen.getByTestId("entity-detail")).toBeInTheDocument();
    });
    expect(screen.getByTestId("entity-detail")).toHaveAttribute("data-entity", "invoice");
  });

  it("redirects to the default entity when no entity is in the URL", async () => {
    vi.mocked(useSelectedEntity).mockReturnValue(
      makeEntityResult({ entities: [INVOICE], selectedEntity: INVOICE }),
    );
    renderRouter("/");
    await waitFor(() => {
      expect(screen.getByTestId("entity-detail")).toBeInTheDocument();
    });
    expect(screen.getByTestId("entity-detail")).toHaveAttribute("data-entity", "invoice");
  });

  it("renders the entity from the URL even when a different default entity is set", async () => {
    vi.mocked(useSelectedEntity).mockReturnValue(
      makeEntityResult({ entities: [INVOICE, CUSTOMER], selectedEntity: INVOICE }),
    );
    renderRouter("/customer");
    await waitFor(() => {
      expect(screen.getByTestId("entity-detail")).toBeInTheDocument();
    });
    expect(screen.getByTestId("entity-detail")).toHaveAttribute("data-entity", "customer");
  });
});

describe("AppLayout — entity selection", () => {
  beforeEach(() => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult());
  });

  it("renders EntitySelector with available entities", async () => {
    vi.mocked(useSelectedEntity).mockReturnValue(
      makeEntityResult({ entities: [INVOICE, CUSTOMER] }),
    );
    renderRouter("/");
    await waitFor(() => {
      expect(screen.getByTestId("entity-selector")).toBeInTheDocument();
    });
  });

  it("calls setSelectedEntity and navigates when an entity is chosen", async () => {
    const setSelectedEntity = vi.fn();
    vi.mocked(useSelectedEntity).mockReturnValue(
      makeEntityResult({
        entities: [INVOICE, CUSTOMER],
        selectedEntity: INVOICE,
        setSelectedEntity,
      }),
    );
    const user = userEvent.setup();
    renderRouter("/invoice");
    await waitFor(() => expect(screen.getByTestId("entity-selector")).toBeInTheDocument());
    await user.selectOptions(screen.getByTestId("entity-selector"), "customer");
    expect(setSelectedEntity).toHaveBeenCalledWith(CUSTOMER);
  });
});
