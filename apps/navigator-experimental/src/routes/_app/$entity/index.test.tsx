/**
 * Tests for the experimental app's EntityItemCollectionRoute loader: it preloads the same entity
 * the view shows, with the router context. The view is mocked to a stub (same technique as
 * ../../__root.test.tsx).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type AnyRouter,
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { useAppAuth } from "@contentgrid/navigator-data";
import { makeTestAppConfig } from "@contentgrid/navigator-data/test-fixtures/auth/app-config";
import { routeTree } from "../../../routeTree.gen";

// jsdom does not implement window.matchMedia; SideBarLayout renders the real
// SidebarProvider (@contentgrid/ui), which uses useIsMobile → matchMedia.
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(cleanup);

// Same mock stack as ../../__root.test.tsx: AuthShell/SideBarLayout are the real, unmocked
// components — they're exercised through mocks of what THEY depend on, so the real
// EntityItemCollectionRoute underneath gets a working NavigatorDataProvider context.
vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useAppAuth: vi.fn(),
    getAppConfig: () => makeTestAppConfig(),
    useLoadedProfileEntities: () => ({ profiles: [], isLoading: false }),
    useProfileEntity: ({ name }: { name?: string }) => ({
      data: name ? { name, pluralName: `${name}s`, singularName: name } : undefined,
      isPending: false,
      isError: false,
      error: undefined,
    }),
  };
});

vi.mock("@contentgrid/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/ui")>();
  return {
    ...actual,
    SignInGate: ({ onSignIn }: { onSignIn: () => void }) => (
      <button onClick={onSignIn}>Sign in</button>
    ),
  };
});

vi.mock("@contentgrid/features/dashboard", () => ({
  EntityCountOverview: () => <div data-testid="entity-overview" />,
}));

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
    contentFetch: vi.fn(),
    profileUrl: "https://api.example.com/profile",
  } as unknown as AppAuthResult;
}

beforeEach(() => {
  vi.mocked(useAppAuth).mockReturnValue(makeAuthResult());
});

const preloadEntityItemCollection = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@contentgrid/views/entity-item-collection", () => ({
  preloadEntityItemCollection,
  EntityItemCollectionView: ({ entityName }: { entityName: string }) => (
    <div data-testid="entity-detail" data-entity={entityName} />
  ),
}));

function renderEntityRoute(queryClient: QueryClient, initialPath = "/invoice") {
  const router = createRouter({
    routeTree,
    context: { queryClient, apiFetch: null, profileUrl: null },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  }) as AnyRouter;

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { ...view, router };
}

describe("EntityItemCollectionRoute — loader", () => {
  it("preloads the entity's collection view with the router context", async () => {
    renderEntityRoute(new QueryClient(), "/invoice");
    await screen.findByTestId("entity-detail");

    expect(preloadEntityItemCollection).toHaveBeenCalledWith(
      expect.objectContaining({ queryClient: expect.anything() }),
      "invoice",
    );
  });
});
