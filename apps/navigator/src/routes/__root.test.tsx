import type { ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeTree } from "../routeTree.gen";

// This suite tests routing/layout behaviour only — auth-gating itself is
// RootAuthGate's job, already covered by
// packages/features/src/app-shell/root-auth-gate.test.tsx, so it's mocked
// here as a passthrough rather than re-tested. Route loaders are similarly
// no-op'd rather than exercised against real data (see the
// @contentgrid/features/entity-list mock below).
vi.mock("@contentgrid/features/app-shell", () => ({
  RootAuthGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@contentgrid/features/navigator-header", () => ({
  NavigatorHeader: () => <header role="banner" data-testid="navigator-header" />,
}));

vi.mock("@contentgrid/features/entity-list", async () => {
  const router =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  const EntityDetailPage = () => {
    const { entity } = router.useParams({ strict: false }) as { entity: string };
    return <div data-testid="entity-detail" data-entity={entity} />;
  };
  const EntityItemDetailPage = () => <div data-testid="entity-item-detail" />;
  const validateEntitySearchState = (search: Record<string, unknown>) => search;
  return {
    EntityListLayout: () => <router.Outlet />,
    EntityOverviewPage: () => <div data-testid="entity-overview" />,
    EntityDetailPage,
    EntityItemDetailPage,
    validateEntitySearchState,
    // Loaders are irrelevant here — this suite only exercises routing, never
    // real prefetch data — so no loader/loaderDeps is provided.
    entityDetailRouteOptions: {
      validateSearch: validateEntitySearchState,
      component: EntityDetailPage,
    },
    entityItemDetailRouteOptions: {
      validateSearch: validateEntitySearchState,
      component: EntityItemDetailPage,
    },
  };
});

afterEach(cleanup);

function renderRouter(initialPath = "/") {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: {
      queryClient: new QueryClient(),
      apiFetch: vi.fn(),
      profileUrl: "https://api.example.com/profile",
    },
  });
  return render(<RouterProvider router={router} />);
}

describe("RootComponent — layout", () => {
  it("renders the navigator header", async () => {
    renderRouter();
    await waitFor(() => {
      expect(screen.getByTestId("navigator-header")).toBeInTheDocument();
    });
  });
});

describe("AppLayout — entity routing", () => {
  it("renders entity overview when no entity is in the URL", async () => {
    renderRouter("/");
    await waitFor(() => {
      expect(screen.getByTestId("entity-overview")).toBeInTheDocument();
    });
  });

  it("renders entity detail when entity path param is in the URL", async () => {
    renderRouter("/invoice");
    await waitFor(() => {
      expect(screen.getByTestId("entity-detail")).toBeInTheDocument();
    });
    expect(screen.getByTestId("entity-detail")).toHaveAttribute("data-entity", "invoice");
  });
});
