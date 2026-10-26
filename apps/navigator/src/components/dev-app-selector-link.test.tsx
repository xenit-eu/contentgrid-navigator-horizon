import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { SidebarProvider } from "@contentgrid/ui";
import { DevAppSelectorLink } from "./dev-app-selector-link";

describe("DevAppSelectorLink", () => {
  beforeAll(() => {
    // jsdom has no matchMedia, which the sidebar provider reads.
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });

  it("links to the backend selector", async () => {
    const rootRoute = createRootRoute({
      component: () => (
        <SidebarProvider>
          <DevAppSelectorLink />
        </SidebarProvider>
      ),
    });
    const configRoute = createRoute({ getParentRoute: () => rootRoute, path: "/config" });
    const router = createRouter({
      routeTree: rootRoute.addChildren([configRoute]),
      history: createMemoryHistory({ initialEntries: ["/config"] }),
    });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("link", { name: "App selector" })).toHaveAttribute(
      "href",
      "/config",
    );
  });
});
