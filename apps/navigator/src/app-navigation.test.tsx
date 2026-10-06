import {
  type AnyRouter,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useNavigation } from "@contentgrid/views";
import { AppNavigationProvider } from "./app-navigation";

afterEach(cleanup);

function Buttons() {
  const navigation = useNavigation();
  return (
    <>
      <button onClick={() => navigation.openHome()}>home</button>
      <button onClick={() => navigation.openEntityItemCollection("company")}>collection</button>
      <button onClick={() => navigation.openItem("company", "c-1")}>item</button>
      <button onClick={() => navigation.openCreateItem("company")}>create</button>
    </>
  );
}

function renderAt(initialPath: string) {
  const root = createRootRoute({
    component: () => (
      <AppNavigationProvider>
        <Buttons />
        <Outlet />
      </AppNavigationProvider>
    ),
  });
  const paths = ["/", "/$entity", "/$entity/$itemId", "/$entity/~create"];
  const router = createRouter({
    routeTree: root.addChildren(
      paths.map((path) => createRoute({ getParentRoute: () => root, path, component: () => null })),
    ),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  }) as AnyRouter;
  render(<RouterProvider router={router} />);
  return router;
}

describe("AppNavigationProvider", () => {
  it.each([
    ["home", "/company/c-1", "/"],
    ["collection", "/", "/company"],
    ["item", "/", "/company/c-1"],
    ["create", "/", "/company/~create"],
  ])("%s changes the route", async (button, from, to) => {
    const router = renderAt(from);
    await userEvent.click(await screen.findByText(button));
    await waitFor(() => expect(router.state.location.pathname).toBe(to));
  });
});
