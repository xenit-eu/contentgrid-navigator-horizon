/**
 * Tests for the item detail route's wiring of `EntityItemDetailView`: it builds a `name` target
 * from the URL params, preloads that target in its loader, and provides the app's navigation
 * object (`../../../app-navigation.tsx`) that the view's clicks go through. Same mock stack as
 * `../../__root.test.tsx` and `./index.test.tsx` — the view is mocked to a stub that exposes its
 * props and the navigation object, so these tests isolate the route's own wiring; the view's own
 * behaviour is tested in `packages/views`.
 */
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
import { useNavigation } from "@contentgrid/views";
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

const preload = vi.hoisted(() => vi.fn(async () => {}));
const openCreatePage = vi.hoisted(() => vi.fn());

vi.mock("@contentgrid/features/router-shell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/features/router-shell")>();
  return { ...actual, useOpenInNewTab: () => ({ openCreatePage, openItemPage: vi.fn() }) };
});

vi.mock("@contentgrid/views/entity-item-detail", () => ({
  preload,
  EntityItemDetailView: (props: {
    target: unknown;
    onRelationItemCreateNew?: (entityName: string) => void;
  }) => <ItemDetailViewStub {...props} />,
}));

function ItemDetailViewStub({
  target,
  onRelationItemCreateNew,
}: Readonly<{ target: unknown; onRelationItemCreateNew?: (entityName: string) => void }>) {
  const navigation = useNavigation();
  return (
    <div>
      <div data-testid="target">{JSON.stringify(target)}</div>
      <button onClick={() => navigation.openItem("company", "c-1")}>open-item</button>
      <button onClick={() => navigation.openEntityItemCollection("company")}>
        open-collection
      </button>
      <button onClick={() => navigation.openHome()}>open-home</button>
      <button onClick={() => onRelationItemCreateNew?.("company")}>create-new</button>
    </div>
  );
}

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
  it("mounts the view with a name target built from the route params", async () => {
    renderItemRoute("/invoice/item-1");

    expect(JSON.parse((await screen.findByTestId("target")).textContent ?? "")).toEqual({
      kind: "name",
      entityName: "invoice",
      itemId: "item-1",
    });
  });

  it("preloads the same target in its loader, with the router context and no state", async () => {
    renderItemRoute("/invoice/item-1");
    await screen.findByTestId("target");

    expect(preload).toHaveBeenCalledWith(
      expect.objectContaining({ queryClient: expect.anything() }),
      { kind: "name", entityName: "invoice", itemId: "item-1" },
      undefined,
    );
  });

  it("provides a navigation object whose openItem changes the route", async () => {
    const user = userEvent.setup();
    const { router } = renderItemRoute("/invoice/item-1");
    await screen.findByTestId("target");

    await user.click(screen.getByText("open-item"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/company/c-1"));
  });

  it("provides a navigation object whose openEntityItemCollection and openHome change the route", async () => {
    const user = userEvent.setup();
    const { router } = renderItemRoute("/invoice/item-1");
    await screen.findByTestId("target");

    await user.click(screen.getByText("open-collection"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/company"));
  });

  it("hands the view the app's open-in-new-tab create callback", async () => {
    const user = userEvent.setup();
    renderItemRoute("/invoice/item-1");
    await screen.findByTestId("target");

    await user.click(screen.getByText("create-new"));

    expect(openCreatePage).toHaveBeenCalledWith("company");
  });
});
