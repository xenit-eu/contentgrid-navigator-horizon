/**
 * Where Continue and Cancel lead from /~create. The view is a stub exposing its two callbacks;
 * the rest is the mock stack the _app layout needs.
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
import type { AppAuthResult, ProfileEntity } from "@contentgrid/navigator-data";
import { useAppAuth } from "@contentgrid/navigator-data";
import { makeTestAppConfig } from "@contentgrid/navigator-data/test-fixtures/auth/app-config";
import { routeTree } from "../../routeTree.gen";

// jsdom does not implement window.matchMedia; SideBarLayout's SidebarProvider needs it.
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

vi.mock("@contentgrid/features/entity-item-collection", () => ({
  EntityItemCollectionSearchView: () => <div data-testid="collection" />,
}));

vi.mock("@contentgrid/features/entity-item-create", () => ({
  ClassifyCreateEntityItemView: (props: {
    onSelect: (profile: ProfileEntity) => void;
    onCancel: () => void;
  }) => (
    <div>
      <button onClick={() => props.onSelect({ name: "invoice" } as ProfileEntity)}>Continue</button>
      <button onClick={props.onCancel}>Cancel</button>
    </div>
  ),
  CreateEntityItemView: () => <div data-testid="create-form" />,
  CreateEntityItemProfileSelector: () => null,
}));

beforeEach(() => {
  vi.mocked(useAppAuth).mockReturnValue({
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
  } as unknown as AppAuthResult);
});

function renderCreateItemRoute(initialEntries: string[]) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient, apiFetch: null, profileUrl: null },
    history: createMemoryHistory({ initialEntries }),
  }) as AnyRouter;
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("ClassifyCreateEntityItemRoute", () => {
  it("opens the chosen entity's create form on Continue", async () => {
    const user = userEvent.setup();
    const router = renderCreateItemRoute(["/~create"]);

    await user.click(await screen.findByRole("button", { name: "Continue" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/invoice/~create"));
  });

  it.each([
    { from: ["/invoice", "/~create"], to: "/invoice", when: "the previous page" },
    { from: ["/~create"], to: "/", when: "the dashboard when there is no previous page" },
  ])("returns to $when on Cancel", async ({ from, to }) => {
    const user = userEvent.setup();
    const router = renderCreateItemRoute(from);

    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(router.state.location.pathname).toBe(to));
  });
});
