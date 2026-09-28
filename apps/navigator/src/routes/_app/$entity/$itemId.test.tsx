/**
 * Tests for EntityItemDetailRoute's wiring of `EntityItemContentFocusView` (promoted from
 * `apps/navigator-experimental` — ACC-2902 content-focus promotion): breadcrumb links, the
 * relation-item navigation callback, and the relation-problem dialog. Same mock stack/technique
 * as `../__root.test.tsx` and `./index.test.tsx` — `EntityItemContentFocusView` is mocked to a
 * data-capturing stub so these tests isolate the route's own wiring (breadcrumb `Link`
 * composition, navigation, dialog state) without re-exercising the view's own content-preview
 * rendering (covered by the feature's own tests).
 */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type AnyRouter,
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

// Captures whatever the route passes down, and exposes buttons that fire the same callbacks a
// real content-focus view would (relation click, the three mutation-problem callbacks) plus the
// breadcrumb render props, so the route's own composition (real router `Link`s) is exercised.
vi.mock("@contentgrid/features/entity-item", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/features/entity-item")>();
  return {
    ...actual,
    EntityItemContentFocusView: (props: {
      entityName: string;
      itemId: string;
      renderHomeLink?: (label: ReactNode) => ReactNode;
      renderCollectionLink?: (entityName: string, label: ReactNode) => ReactNode;
      onRelationItemClick?: (target: { entityName: string; itemId: string }) => void;
      onMissingRelationTargetClick?: (url: string, field?: string) => void;
      onBlindRelationOverwriteClick?: (info: {
        existingItem?: string;
        existingRelation?: string;
        newItem?: string;
        newRelation?: string;
      }) => void;
      onRequiredRelationClick?: (affectedRelation: string) => void;
    }) => (
      <div>
        <div data-testid="entity-name">{props.entityName}</div>
        <div data-testid="item-id">{props.itemId}</div>
        {/* Scoped container: the real SideBarLayout (unmocked) also renders a "Home" link (its
            logo/nav home button) with the same accessible name — queries need to distinguish the
            breadcrumb's own links from the sidebar's. */}
        <div data-testid="breadcrumbs">
          {props.renderHomeLink?.("Home")}
          {props.renderCollectionLink?.("company", "Companies")}
        </div>
        <button
          onClick={() => props.onRelationItemClick?.({ entityName: "company", itemId: "c-1" })}
        >
          go-to-relation
        </button>
        <button
          onClick={() => props.onMissingRelationTargetClick?.("https://api.example.com/x", "owner")}
        >
          trigger-missing-relation-target
        </button>
        <button
          onClick={() =>
            props.onBlindRelationOverwriteClick?.({
              existingItem: "https://api.example.com/existing",
              newItem: "https://api.example.com/new",
            })
          }
        >
          trigger-blind-relation-overwrite
        </button>
        <button onClick={() => props.onRequiredRelationClick?.("owner")}>
          trigger-required-relation
        </button>
      </div>
    ),
  };
});

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

describe("EntityItemDetailRoute — content-focus wiring", () => {
  it("mounts EntityItemContentFocusView with the route's entity name and item id", async () => {
    renderItemRoute("/invoice/item-1");

    expect(await screen.findByTestId("entity-name")).toHaveTextContent("invoice");
    expect(screen.getByTestId("item-id")).toHaveTextContent("item-1");
  });

  it("renders the home and collection breadcrumbs as real router links", async () => {
    renderItemRoute("/invoice/item-1");

    const breadcrumbs = within(await screen.findByTestId("breadcrumbs"));
    expect(breadcrumbs.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(breadcrumbs.getByRole("link", { name: "Companies" })).toHaveAttribute(
      "href",
      "/company",
    );
  });

  it("navigates to the related item on onRelationItemClick", async () => {
    const user = userEvent.setup();
    const { router } = renderItemRoute("/invoice/item-1");
    await screen.findByTestId("entity-name");

    await user.click(screen.getByText("go-to-relation"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/company/c-1"));
  });

  it("shows the missing-relation-target dialog", async () => {
    const user = userEvent.setup();
    renderItemRoute("/invoice/item-1");
    await screen.findByTestId("entity-name");

    await user.click(screen.getByText("trigger-missing-relation-target"));

    expect(await screen.findByText("Linked item not found")).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/api\.example\.com\/x/)).toBeInTheDocument();
  });

  it("shows the blind-relation-overwrite dialog", async () => {
    const user = userEvent.setup();
    renderItemRoute("/invoice/item-1");
    await screen.findByTestId("entity-name");

    await user.click(screen.getByText("trigger-blind-relation-overwrite"));

    expect(await screen.findByText("Relation already linked")).toBeInTheDocument();
  });

  it("shows the required-relation dialog", async () => {
    const user = userEvent.setup();
    renderItemRoute("/invoice/item-1");
    await screen.findByTestId("entity-name");

    await user.click(screen.getByText("trigger-required-relation"));

    expect(await screen.findByText("Required relation")).toBeInTheDocument();
  });
});
