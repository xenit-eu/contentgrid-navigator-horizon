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
import { useProfileEntity } from "@contentgrid/navigator-data";
import {
  RecordingNavigationProvider,
  createRecordingNavigation,
} from "../../navigation/recording-navigation";
import { EntityProfileGate } from "./entity-profile-gate";
import { EntityProfileGateRoute } from "./entity-profile-gate-route";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return { ...actual, useProfileEntity: vi.fn() };
});

function mockProfile(result: {
  data?: unknown;
  isPending?: boolean;
  isError?: boolean;
  error?: unknown;
}) {
  vi.mocked(useProfileEntity).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    ...result,
  } as unknown as ReturnType<typeof useProfileEntity>);
}

function withQueryClient(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe("EntityProfileGate", () => {
  it("renders its children once the profile has loaded", () => {
    mockProfile({ data: { name: "invoice" } });
    render(
      <EntityProfileGate entityName="invoice" onBackHome={vi.fn()}>
        <div>page</div>
      </EntityProfileGate>,
    );

    expect(screen.getByText("page")).toBeInTheDocument();
  });

  it("does not render its children while the profile is loading", () => {
    mockProfile({ isPending: true });
    render(
      <EntityProfileGate entityName="invoice" onBackHome={vi.fn()}>
        <div>page</div>
      </EntityProfileGate>,
    );

    expect(screen.queryByText("page")).not.toBeInTheDocument();
  });

  it("shows the error page for a failed fetch, without a way back home", () => {
    mockProfile({ isError: true, error: new Error("boom") });
    render(
      <EntityProfileGate entityName="invoice" onBackHome={vi.fn()}>
        <div>page</div>
      </EntityProfileGate>,
    );

    expect(screen.queryByText("page")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to home" })).not.toBeInTheDocument();
  });

  it("reports back-to-home when the entity does not exist", async () => {
    mockProfile({ data: null });
    const onBackHome = vi.fn();
    render(
      <EntityProfileGate entityName="ghost" onBackHome={onBackHome}>
        <div>page</div>
      </EntityProfileGate>,
    );

    expect(screen.getByText(/Profile ghost does not exist/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to home" }));

    expect(onBackHome).toHaveBeenCalledTimes(1);
  });
});

describe("EntityProfileGateRoute", () => {
  it("reads the entity from the route and opens home through the navigation context", async () => {
    mockProfile({ data: null });
    const recording = createRecordingNavigation();
    const rootRoute = createRootRoute();
    const entityRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/$entity",
      component: EntityProfileGateRoute,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([entityRoute]),
      history: createMemoryHistory({ initialEntries: ["/ghost"] }),
    });

    render(
      withQueryClient(
        <RecordingNavigationProvider recording={recording}>
          <RouterProvider router={router} />
        </RecordingNavigationProvider>,
      ),
    );

    expect(await screen.findByText(/Profile ghost does not exist/)).toBeInTheDocument();
    expect(vi.mocked(useProfileEntity)).toHaveBeenCalledWith({ name: "ghost" });
    await userEvent.click(screen.getByRole("button", { name: "Back to home" }));

    expect(recording.calls).toEqual([{ method: "openHome", args: [] }]);
  });
});
