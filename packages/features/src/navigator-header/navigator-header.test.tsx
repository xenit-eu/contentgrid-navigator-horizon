import type { ReactNode } from "react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useProfileEntities } from "@contentgrid/navigator-data";
import type { ProfileEntityType } from "@contentgrid/navigator-data";
import type { ProfileEntitySelectorProps } from "@contentgrid/ui";
import { NavigatorHeader } from "./index";

vi.mock("@contentgrid/navigator-data", () => ({
  useProfileEntities: vi.fn(),
}));

const mockProfileEntitySelector = vi.hoisted(() =>
  vi.fn<(props: ProfileEntitySelectorProps) => null>(() => null),
);

vi.mock("@contentgrid/ui", () => ({
  BrandingHeader: ({ actions }: { actions?: ReactNode }) => (
    <header role="banner">{actions}</header>
  ),
  ProfileEntitySelector: mockProfileEntitySelector,
}));

afterEach(cleanup);
afterEach(() => mockProfileEntitySelector.mockClear());

const INVOICE = { name: "invoice", title: "Invoice" } as unknown as ProfileEntityType;
const CUSTOMER = { name: "customer", title: "Customer" } as unknown as ProfileEntityType;

function makeProfileEntitiesResult(
  entities: ProfileEntityType[],
): ReturnType<typeof useProfileEntities> {
  return entities.map((entity) => ({
    data: entity,
    isLoading: false,
    isPending: false,
    isError: false,
    isSuccess: true,
    error: null,
    status: "success" as const,
  })) as unknown as ReturnType<typeof useProfileEntities>;
}

function renderAtPath(path: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <NavigatorHeader />
        <Outlet />
      </>
    ),
  });
  const entityRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/$entity",
    component: () => null,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([entityRoute, indexRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

function lastSelectorProps() {
  return mockProfileEntitySelector.mock.calls.at(-1)?.[0];
}

describe("NavigatorHeader", () => {
  it("passes all loaded entities to ProfileEntitySelector", async () => {
    vi.mocked(useProfileEntities).mockReturnValue(makeProfileEntitiesResult([INVOICE, CUSTOMER]));
    renderAtPath("/");
    await waitFor(() => expect(lastSelectorProps()?.entities).toEqual([INVOICE, CUSTOMER]));
  });

  it("passes the entity matching the URL param as selectedEntity", async () => {
    vi.mocked(useProfileEntities).mockReturnValue(makeProfileEntitiesResult([INVOICE, CUSTOMER]));
    renderAtPath("/invoice");
    await waitFor(() => expect(lastSelectorProps()?.selectedEntity).toEqual(INVOICE));
  });

  it("passes undefined as selectedEntity when no entity is in the URL", async () => {
    vi.mocked(useProfileEntities).mockReturnValue(makeProfileEntitiesResult([INVOICE, CUSTOMER]));
    renderAtPath("/");
    await waitFor(() => expect(lastSelectorProps()?.selectedEntity).toBeUndefined());
  });
});
