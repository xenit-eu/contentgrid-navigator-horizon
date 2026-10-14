/**
 * Tests for the item detail route's wiring of `EntityItemDetailView`: it passes the route's
 * entity name and item id straight through, and preloads the same pair in its loader. Same mock
 * stack as `../../__root.test.tsx` and `./index.test.tsx` — the view is mocked to a stub that
 * exposes its props, so these tests isolate the route's own wiring; the view's own behaviour
 * (including navigation) is tested in `packages/views`.
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

// Same mock stack as ../../__root.test.tsx: AuthShell/SideBarLayout/EntityProfileGate are the
// real, unmocked components — exercised through mocks of what they depend on, so the real
// $itemId route underneath gets a working NavigatorDataProvider context.
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

const preloadEntityItemDetail = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@contentgrid/views/entity-item-detail", () => ({
  preloadEntityItemDetail,
  EntityItemDetailView: (props: { entityName: string; itemId: string }) => (
    <div>
      <div data-testid="entity-name">{props.entityName}</div>
      <div data-testid="item-id">{props.itemId}</div>
    </div>
  ),
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

function renderItemRoute(initialPath = "/invoice/item-1") {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient, apiFetch: null, profileUrl: null },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  }) as AnyRouter;

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    router,
  };
}

describe("EntityItemDetailRoute — view wiring", () => {
  it("mounts the view with the route's entity name and item id", async () => {
    renderItemRoute("/invoice/item-1");

    expect(await screen.findByTestId("entity-name")).toHaveTextContent("invoice");
    expect(screen.getByTestId("item-id")).toHaveTextContent("item-1");
  });

  it("preloads the same pair in its loader, with the router context", async () => {
    renderItemRoute("/invoice/item-1");
    await screen.findByTestId("entity-name");

    expect(preloadEntityItemDetail).toHaveBeenCalledWith(
      expect.objectContaining({ queryClient: expect.anything() }),
      "invoice",
      "item-1",
    );
  });
});
