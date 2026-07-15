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
import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundPage } from "./not-found-page";

function renderNotFound(initialEntry = "/does-not-exist") {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>home</div>,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    defaultNotFoundComponent: NotFoundPage,
  });

  return render(<RouterProvider router={router} />);
}

describe("NotFoundPage", () => {
  // Both tests exercise the same unmatched-route render — hoisted since it's
  // identical across every test in this describe.
  beforeEach(() => {
    renderNotFound();
  });

  it("renders a not-found message for an unmatched route", async () => {
    expect(await screen.findByText("This page doesn't exist.")).toBeInTheDocument();
  });

  it("navigates home when the back-to-home button is clicked", async () => {
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Back to home" }));

    expect(await screen.findByText("home")).toBeInTheDocument();
  });
});
