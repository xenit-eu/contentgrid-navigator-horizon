import type { ReactNode } from "react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useProfileEntities } from "@contentgrid/navigator-data";
import type { ProfileEntityType } from "@contentgrid/navigator-data";
import type { ProfileEntitySelectorProps } from "@contentgrid/ui";
import { NavigatorHeader } from "./index";

vi.mock("@contentgrid/navigator-data", () => ({
  useProfileEntities: vi.fn(),
}));

// Kept minimal/shallow — this still isolates NavigatorHeader's own logic rather
// than rendering the real ProfileEntitySelector/BrandingHeader — but each mock
// renders a real, queryable DOM marker of the props it received, so tests can
// assert on actual rendered output instead of only the mock's captured call args.
const mockProfileEntitySelector = vi.hoisted(() =>
  vi.fn((props: ProfileEntitySelectorProps) => (
    <div data-testid="profile-entity-selector">
      {JSON.stringify({
        entityNames: props.entities.map((entity) => entity.name),
        selectedEntityName: props.selectedEntity?.name ?? null,
      })}
    </div>
  )),
);

vi.mock("@contentgrid/ui", () => ({
  BrandingHeader: ({ title, actions }: { title?: string; actions?: ReactNode }) => (
    <header role="banner">
      <span data-testid="branding-title">{title}</span>
      {actions}
    </header>
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

/** Reads back the marker rendered by the mocked ProfileEntitySelector. */
function renderedSelectorMarker() {
  const raw = screen.getByTestId("profile-entity-selector").textContent;
  return JSON.parse(raw ?? "null") as {
    entityNames: string[];
    selectedEntityName: string | null;
  };
}

describe("NavigatorHeader", () => {
  it("passes all loaded entities to ProfileEntitySelector", async () => {
    vi.mocked(useProfileEntities).mockReturnValue(makeProfileEntitiesResult([INVOICE, CUSTOMER]));
    renderAtPath("/");

    await waitFor(() =>
      expect(renderedSelectorMarker().entityNames).toEqual(["invoice", "customer"]),
    );
    // Also confirm it's real rendered NavigatorHeader chrome, not just captured call args.
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByTestId("branding-title")).toHaveTextContent("Navigator");
    expect(lastSelectorProps()?.entities).toEqual([INVOICE, CUSTOMER]);
  });

  it("passes the entity matching the URL param as selectedEntity", async () => {
    vi.mocked(useProfileEntities).mockReturnValue(makeProfileEntitiesResult([INVOICE, CUSTOMER]));
    renderAtPath("/invoice");

    await waitFor(() => expect(renderedSelectorMarker().selectedEntityName).toBe("invoice"));
    expect(lastSelectorProps()?.selectedEntity).toEqual(INVOICE);
  });

  it("passes undefined as selectedEntity when no entity is in the URL", async () => {
    vi.mocked(useProfileEntities).mockReturnValue(makeProfileEntitiesResult([INVOICE, CUSTOMER]));
    renderAtPath("/");

    await waitFor(() => expect(renderedSelectorMarker().selectedEntityName).toBeNull());
    expect(lastSelectorProps()?.selectedEntity).toBeUndefined();
  });
});
