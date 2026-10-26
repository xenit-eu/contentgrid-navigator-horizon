import type { ReactNode } from "react";
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

function renderShell(initialEntry = "/", footer?: ReactNode) {
  mockSidebarData({ profile: { name: "Jane Doe", email: "jane@example.com" } });

  const recording = createRecordingNavigation();
  const rootRoute = createRootRoute({ component: () => <SidebarShell footer={footer} /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>routed page</div>,
  });
  const entityRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/$entity",
    component: () => <div>entity page</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, entityRoute]),
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
    await userEvent.click(screen.getByRole("button", { name: "Create Item" }));
    await userEvent.click(screen.getByRole("link", { name: "Home" }));
    await userEvent.click(screen.getByText("Jane Doe"));
    await userEvent.click(await screen.findByText("Settings"));

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

  it("renders the footer the app passes in", async () => {
    renderShell("/", <span>app footer</span>);

    expect(await screen.findByText("app footer")).toBeInTheDocument();
  });
});
