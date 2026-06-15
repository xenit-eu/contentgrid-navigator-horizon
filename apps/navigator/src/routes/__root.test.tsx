import type { ReactNode } from "react";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppAuthResult,
  EntityInfo,
  UseSelectedProfileResult,
} from "@contentgrid/navigator-data";
import { useAppAuth, useSelectedProfile } from "@contentgrid/navigator-data";
import { routeTree } from "../routeTree.gen";

vi.mock("@contentgrid/navigator-data", () => ({
  useAppAuth: vi.fn(),
  useSelectedProfile: vi.fn(),
  NavigatorDataProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@contentgrid/ui", () => ({
  BrandingHeader: ({ actions }: { actions?: ReactNode }) => (
    <header role="banner">{actions}</header>
  ),
  ProfileSelector: () => null,
  SignInGate: ({ onSignIn }: { onSignIn: () => void }) => (
    <button onClick={onSignIn}>Sign in</button>
  ),
}));

vi.mock("@contentgrid/features/entity-list", () => ({
  EntityList: ({ entityName }: { entityName?: string }) => (
    <div data-testid="entity-list" data-entity={entityName ?? ""} />
  ),
}));

afterEach(cleanup);

const INVOICE: EntityInfo = {
  name: "invoice",
  title: "Invoice",
  href: "/profile/invoices",
  collectionHref: "/invoices",
};

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

function makeProfileResult(
  overrides: Partial<UseSelectedProfileResult> = {},
): UseSelectedProfileResult {
  return {
    profiles: [],
    selectedProfile: null,
    setSelectedProfile: vi.fn() as UseSelectedProfileResult["setSelectedProfile"],
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
    vi.mocked(useSelectedProfile).mockReturnValue(makeProfileResult());
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
    vi.mocked(useSelectedProfile).mockReturnValue(makeProfileResult());
  });

  it("renders EntityList with no entity when URL has no entity param", async () => {
    renderRouter("/");
    await waitFor(() => {
      expect(screen.getByTestId("entity-list")).toBeInTheDocument();
    });
    expect(screen.getByTestId("entity-list")).toHaveAttribute("data-entity", "");
  });

  it("renders EntityList with the entity from the URL search param", async () => {
    renderRouter("/?entity=invoice");
    await waitFor(() => {
      expect(screen.getByTestId("entity-list")).toBeInTheDocument();
    });
    expect(screen.getByTestId("entity-list")).toHaveAttribute("data-entity", "invoice");
  });

  it("redirects to the default profile when no entity is in the URL", async () => {
    vi.mocked(useSelectedProfile).mockReturnValue(
      makeProfileResult({ profiles: [INVOICE], selectedProfile: INVOICE }),
    );
    renderRouter("/");
    await waitFor(() => {
      expect(screen.getByTestId("entity-list")).toHaveAttribute("data-entity", "invoice");
    });
  });

  it("renders the entity from the URL even when a default profile is set", async () => {
    vi.mocked(useSelectedProfile).mockReturnValue(
      makeProfileResult({ profiles: [INVOICE], selectedProfile: INVOICE }),
    );
    renderRouter("/?entity=invoice");
    await waitFor(() => {
      expect(screen.getByTestId("entity-list")).toHaveAttribute("data-entity", "invoice");
    });
  });
});
