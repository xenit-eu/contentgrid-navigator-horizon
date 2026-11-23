import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  RecordingNavigationProvider,
  createRecordingNavigation,
} from "../../navigation/recording-navigation";
import { mockSidebarData } from "../../test-fixtures/sidebar-harness";
import { SidebarShell } from "./sidebar-shell";

vi.mock("@contentgrid/features/preferences", async () => {
  const { preferencesModuleMock } = await import("../../test-fixtures/sidebar-mocks");
  return preferencesModuleMock;
});

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const { sidebarNavigatorDataMock } = await import("../../test-fixtures/sidebar-mocks");
  return sidebarNavigatorDataMock(importOriginal);
});

function renderShell(initialEntry = "/") {
  mockSidebarData({ profile: { name: "Jane Doe", email: "jane@example.com" } });

  const recording = createRecordingNavigation();
  const rootRoute = createRootRoute({ component: () => <SidebarShell /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>routed page</div>,
  });
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/~configuration",
    component: () => <div>settings page</div>,
  });
  const entityRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/$entity",
    component: () => <div>entity page</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, settingsRoute, entityRoute]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RecordingNavigationProvider recording={recording}>
        <RouterProvider router={router} />
      </RecordingNavigationProvider>
    </QueryClientProvider>,
  );
  return recording;
}

describe("SidebarShell", () => {
  it("renders the routed page inside the sidebar frame", async () => {
    renderShell();

    expect(await screen.findByText("routed page")).toBeInTheDocument();
  });

  it("marks the entity of the current route as active", async () => {
    renderShell("/invoice");

    const link = await screen.findByRole("link", { name: /invoice/i });
    expect(link.closest("[data-active]")).toHaveAttribute("data-active", "true");
  });

  it("opens entities, create, home and settings through the navigation context", async () => {
    const recording = renderShell();

    await userEvent.click(await screen.findByRole("link", { name: /invoice/i }));
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await userEvent.click(screen.getByRole("link", { name: "Home" }));
    await userEvent.click(screen.getByRole("button", { name: /jane doe/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Settings" }));

    expect(recording.calls).toEqual([
      { method: "openEntityItemCollection", args: ["invoice", { restoreState: false }] },
      { method: "openClassifyCreate", args: [] },
      { method: "openHome", args: [] },
      { method: "openSettings", args: [] },
    ]);
  });

  it("gives the entity links the host's real hrefs", async () => {
    renderShell();

    expect(await screen.findByRole("link", { name: /invoice/i })).toHaveAttribute(
      "href",
      "/invoice",
    );
  });

  it("shows Settings as current in the user menu on a settings page", async () => {
    renderShell("/~configuration");

    await userEvent.click(await screen.findByRole("button", { name: /jane doe/i }));

    expect(await screen.findByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not mark Settings as current on other pages", async () => {
    renderShell("/invoice");

    await userEvent.click(await screen.findByRole("button", { name: /jane doe/i }));

    expect(await screen.findByRole("menuitem", { name: "Settings" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Home as current on the home page only", async () => {
    renderShell("/");
    expect(await screen.findByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not mark Home as current on an entity page", async () => {
    renderShell("/invoice");
    expect(await screen.findByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("marks the bottom Settings row as current on a settings page only", async () => {
    renderShell("/~configuration");
    const link = await screen.findByRole("link", { name: "Settings" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.closest("[data-slot='sidebar-footer']")).toBeInTheDocument();
  });

  it("does not mark the bottom Settings row as current elsewhere", async () => {
    renderShell("/invoice");
    expect(await screen.findByRole("link", { name: "Settings" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
