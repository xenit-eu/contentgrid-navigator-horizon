import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { useAppAuth } from "@contentgrid/navigator-data";
import { SideBarLayout } from "./sidebar-layout";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useAppAuth: vi.fn(),
    useLoadedProfileEntities: () => ({ profiles: [], isLoading: false }),
  };
});

function renderLayout(user: unknown) {
  vi.mocked(useAppAuth).mockReturnValue({
    auth: { isLoading: false, isAuthenticated: true, user, signoutRedirect: vi.fn() },
    apiFetch: vi.fn(),
    contentFetch: vi.fn(),
    profileUrl: "https://api.example.com/profile",
  } as unknown as AppAuthResult);

  const rootRoute = createRootRoute({
    component: () => <SideBarLayout topChildren={<div data-testid="banner" />} />,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("SideBarLayout", () => {
  it("hides the user menu when there is no authenticated user", async () => {
    renderLayout(null);
    expect(await screen.findByTestId("banner")).toBeInTheDocument();
    expect(screen.queryByText("Log out")).not.toBeInTheDocument();
  });

  it("shows the signed-in user's name in the user menu", async () => {
    renderLayout({ profile: { name: "Jane Doe", email: "jane@example.com" }, expired: false });
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
  });

  it("renders topChildren above the routed outlet", async () => {
    renderLayout(null);
    expect(await screen.findByTestId("banner")).toBeInTheDocument();
  });
});
