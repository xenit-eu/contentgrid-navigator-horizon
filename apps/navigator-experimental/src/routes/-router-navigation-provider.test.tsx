import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { recallCollectionFilters, rememberCollectionFilters } from "@contentgrid/navigator-data";
import { useViewNavigation } from "@contentgrid/views";
import { RouterNavigationProvider } from "./-router-navigation-provider";

/** Shows the current pathname+search so tests can assert on the route the provider navigated to,
 * without reaching into the router instance directly. */
function CurrentLocation() {
  const href = useRouterState({ select: (state) => state.location.href });
  return <div data-testid="location">{href}</div>;
}

function NavigationProbe() {
  const navigation = useViewNavigation();
  return (
    <>
      <button onClick={() => navigation.openHome()}>open-home</button>
      <button onClick={() => navigation.openEntityItemCollection("invoice")}>
        open-collection
      </button>
      <button
        onClick={() => navigation.openEntityItemCollection("invoice", { restoreState: false })}
      >
        open-collection-fresh
      </button>
      <button onClick={() => navigation.openItem("invoice", "42")}>open-item</button>
      <button onClick={() => navigation.openCreateItem("invoice")}>open-create</button>
      <button onClick={() => navigation.openCreateItem("invoice", { openInNewTab: true })}>
        open-create-new-tab
      </button>
      <button onClick={() => navigation.openItem("invoice", "42", { openInNewTab: true })}>
        open-item-new-tab
      </button>
      <button onClick={() => navigation.openClassifyCreate()}>open-classify-create</button>
      <button onClick={() => navigation.openSettings()}>open-settings</button>
      <button onClick={() => navigation.openSettings({ openInNewTab: true })}>
        open-settings-new-tab
      </button>
      <span data-testid="href-home">{navigation.hrefFor?.home()}</span>
      <span data-testid="href-collection">
        {navigation.hrefFor?.entityItemCollection("invoice")}
      </span>
      <span data-testid="href-item">{navigation.hrefFor?.item("invoice", "42")}</span>
    </>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <RouterNavigationProvider>
      <NavigationProbe />
      <CurrentLocation />
      <Outlet />
    </RouterNavigationProvider>
  ),
});
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });
const entityRoute = createRoute({ getParentRoute: () => rootRoute, path: "/$entity" });
const itemRoute = createRoute({ getParentRoute: () => rootRoute, path: "/$entity/$itemId" });
const createItemRoute = createRoute({ getParentRoute: () => rootRoute, path: "/$entity/~create" });
const classifyCreateRoute = createRoute({ getParentRoute: () => rootRoute, path: "/~create" });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/~configuration" });
const routeTree = rootRoute.addChildren([
  indexRoute,
  entityRoute,
  itemRoute,
  createItemRoute,
  classifyCreateRoute,
  settingsRoute,
]);

const queryClient = new QueryClient();

function renderRouter(initialPath = "/") {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("RouterNavigationProvider", () => {
  it("builds the same hrefs its open* functions navigate to", async () => {
    renderRouter("/");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/"));

    expect(screen.getByTestId("href-home")).toHaveTextContent("/");
    expect(screen.getByTestId("href-collection")).toHaveTextContent("/invoice");
    expect(screen.getByTestId("href-item")).toHaveTextContent("/invoice/42");
  });

  it("navigates to the collection and back home through open*", async () => {
    renderRouter("/");

    // The router's own initial render is itself async; wait for it to settle before interacting,
    // same as the real app does while mounted under `RouterProvider`.
    await userEvent.click(await screen.findByText("open-collection"));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/invoice"));

    await userEvent.click(screen.getByText("open-item"));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/invoice/42"));

    await userEvent.click(screen.getByText("open-home"));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/"));
  });

  it("opens the collection with an empty search, not the page's own filters", async () => {
    renderRouter("/invoice?q=acme");

    await userEvent.click(await screen.findByText("open-collection"));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/invoice"));
    expect(screen.getByTestId("location")).not.toHaveTextContent("q=acme");
  });

  it("opens an item keeping the current page's search", async () => {
    renderRouter("/invoice?q=acme");

    await userEvent.click(await screen.findByText("open-item"));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/invoice/42?q=acme"),
    );
  });

  it("navigates the current tab to the create page by default", async () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    renderRouter("/");

    await userEvent.click(await screen.findByText("open-create"));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/invoice/~create"),
    );
    expect(windowOpen).not.toHaveBeenCalled();
    windowOpen.mockRestore();
  });

  it("opens the create page in a new tab when openInNewTab is set", async () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    renderRouter("/");

    await userEvent.click(await screen.findByText("open-create-new-tab"));

    expect(windowOpen).toHaveBeenCalledWith("/invoice/~create", "_blank", "noopener,noreferrer");
    expect(screen.getByTestId("location")).toHaveTextContent("/");
    windowOpen.mockRestore();
  });

  it("opens an item in a new tab with the current search, without navigating", async () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    renderRouter("/invoice?q=acme");

    await userEvent.click(await screen.findByText("open-item-new-tab"));

    expect(windowOpen).toHaveBeenCalledWith("/invoice/42?q=acme", "_blank", "noopener,noreferrer");
    expect(screen.getByTestId("location")).toHaveTextContent("/invoice?q=acme");
    windowOpen.mockRestore();
  });

  it("navigates to the classify-create page and to settings", async () => {
    renderRouter("/");

    await userEvent.click(await screen.findByText("open-classify-create"));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/~create"));

    await userEvent.click(screen.getByText("open-settings"));
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/~configuration"),
    );
  });

  it("opens settings in a new tab without navigating", async () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
    renderRouter("/");

    await userEvent.click(await screen.findByText("open-settings-new-tab"));

    expect(windowOpen).toHaveBeenCalledWith("/~configuration", "_blank", "noopener,noreferrer");
    windowOpen.mockRestore();
  });

  it("keeps the list's remembered state when opening a collection, unless restoreState is false", async () => {
    rememberCollectionFilters(queryClient, "invoice", { q: "acme" });
    renderRouter("/");

    await userEvent.click(await screen.findByText("open-collection"));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/invoice"));
    expect(recallCollectionFilters(queryClient, "invoice")).toEqual({ q: "acme" });

    await userEvent.click(screen.getByText("open-collection-fresh"));
    expect(recallCollectionFilters(queryClient, "invoice")).toBeUndefined();
  });
});
