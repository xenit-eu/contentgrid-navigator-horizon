import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NotFoundView } from "@contentgrid/views/not-found";
import { RouterNavigationProvider } from "./-router-navigation-provider";

// The router renders `defaultNotFoundComponent` inside the root route's <Outlet />, so it must find
// the navigation provider the root component mounts, as in `__root.tsx`.
describe("defaultNotFoundComponent with NotFoundView", () => {
  it("renders inside the navigation provider and navigates home from 'Back to home'", async () => {
    const rootRoute = createRootRoute({
      component: () => (
        <RouterNavigationProvider>
          <Outlet />
        </RouterNavigationProvider>
      ),
    });
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => <div>home page</div>,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ["/does-not-exist"] }),
      defaultNotFoundComponent: NotFoundView,
    });
    render(<RouterProvider router={router} />);

    await userEvent.click(await screen.findByRole("button", { name: "Back to home" }));

    expect(await screen.findByText("home page")).toBeInTheDocument();
  });
});
