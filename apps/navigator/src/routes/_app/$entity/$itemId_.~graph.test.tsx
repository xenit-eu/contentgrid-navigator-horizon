/**
 * Tests for the knowledge-graph route's wiring (spec 007): params → EntityGraphView, the `trail`
 * search param (validation, restore on load, write-back on change), and navigation callbacks.
 * EntityGraphView is mocked to a prop-capturing stub; its behaviour is covered by the feature's
 * own tests. Mock stack as in ./$itemId.test.tsx.
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type AnyRouter,
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const captured: { trail?: unknown } = {};

vi.mock("@contentgrid/features/entity-graph", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/features/entity-graph")>();
  return {
    ...actual,
    EntityGraphView: (props: {
      entityName: string;
      itemId: string;
      trail?: readonly { entityName: string; id: string; via?: string }[];
      onTrailChange?: (trail: readonly { entityName: string; id: string; via?: string }[]) => void;
      onOpenItem: (target: { entityName: string; itemId: string }) => void;
      onOpenCollection?: (entityName: string) => void;
      renderHomeLink?: (label: ReactNode) => ReactNode;
    }) => {
      captured.trail = props.trail;
      return (
        <div>
          <div data-testid="entity-name">{props.entityName}</div>
          <div data-testid="item-id">{props.itemId}</div>
          <div data-testid="trail">{JSON.stringify(props.trail)}</div>
          <button
            onClick={() =>
              props.onTrailChange?.([{ entityName: "order", id: "o-1", via: "orders" }])
            }
          >
            explore-order
          </button>
          <button onClick={() => props.onOpenItem({ entityName: "order", itemId: "o-1" })}>
            open-item
          </button>
          <button onClick={() => props.onOpenCollection?.("customer")}>open-collection</button>
        </div>
      );
    },
  };
});

function makeAuthResult(): AppAuthResult {
  return {
    auth: {
      isLoading: false,
      isAuthenticated: true,
      user: null,
      error: undefined,
      signinRedirect: vi.fn(),
    },
    apiFetch: vi.fn(),
    contentFetch: vi.fn(),
    profileUrl: "https://api.example.com/profile",
  } as unknown as AppAuthResult;
}

beforeEach(() => {
  vi.mocked(useAppAuth).mockReturnValue(makeAuthResult());
});

function renderGraphRoute(initialPath: string) {
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

const trailParam = (trail: unknown) => `?trail=${encodeURIComponent(JSON.stringify(trail))}`;

describe("Knowledge-graph route", () => {
  it("mounts EntityGraphView with the route's entity name, item id and an empty trail", async () => {
    renderGraphRoute("/customer/c-1/~graph");
    expect(await screen.findByTestId("entity-name")).toHaveTextContent("customer");
    expect(screen.getByTestId("item-id")).toHaveTextContent("c-1");
    expect(captured.trail).toEqual([]);
  });

  it("restores the trail from the URL and drops malformed entries", async () => {
    renderGraphRoute(
      `/customer/c-1/~graph${trailParam([{ e: "order", id: "o-1", via: "orders" }, { e: "", id: "x" }, 5])}`,
    );
    await screen.findByTestId("entity-name");
    expect(captured.trail).toEqual([{ entityName: "order", id: "o-1", via: "orders" }]);
  });

  it("writes trail changes back to the URL so a reload restores them", async () => {
    const user = userEvent.setup();
    const { router } = renderGraphRoute("/customer/c-1/~graph");
    await screen.findByTestId("entity-name");

    await user.click(screen.getByText("explore-order"));

    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        trail: [{ e: "order", id: "o-1", via: "orders" }],
      }),
    );
    expect(router.state.location.pathname).toBe("/customer/c-1/~graph");
  });

  it("opens the item page and the collection via the view callbacks", async () => {
    const user = userEvent.setup();
    const { router } = renderGraphRoute("/customer/c-1/~graph");
    await screen.findByTestId("entity-name");

    await user.click(screen.getByText("open-item"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/order/o-1"));

    await router.navigate({ to: "/customer/c-1/~graph" as never });
    await user.click(await screen.findByText("open-collection"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/customer"));
  });
});
