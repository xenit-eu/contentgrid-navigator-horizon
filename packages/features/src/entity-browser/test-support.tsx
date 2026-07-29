import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
  entitySearchStateValidator,
} from "@contentgrid/navigator-data";
import { PROFILE_URL } from "@contentgrid/navigator-data/test-fixtures/msw/entity-browser-fixtures";
import { EntityListLayout } from "./app-layout";
import { EntityDetailPage } from "./entity-detail";
import { EntityItemDetailPage } from "./entity-item-detail";
import { EntityOverviewPage } from "./entity-overview";
import { EntityProfileGate } from "./entity-profile-gate";

// Hand-authored profile HAL envelopes and their MSW handlers live in
// navigator-data/test-fixtures/msw/entity-browser-fixtures — shared scaffolding
// belongs in the data-layer package, not duplicated per feature. Re-exported
// here so every test in this directory can keep importing from "./test-support".
export {
  API_URL,
  PROFILE_URL,
  LINE_ITEMS_COLLECTION_URL,
  SUPPLIERS_COLLECTION_URL,
  customerProfileHandler,
  emptyInvoicesList,
  invoiceProfileHandler,
  invoiceProfileHandlerNoCreate,
  invoiceProfileHandlerWithRelations,
  lineItem,
  lineItemProfileHandler,
  makeInvoiceItemWithLineItems,
  makeInvoiceItemWithSupplier,
  notFoundProblem,
  profileRootHandler,
  profileRootWithRelationsHandler,
  profileRootWithTwoEntitiesHandler,
  sampleItem,
  supplierProfileHandler,
} from "@contentgrid/navigator-data/test-fixtures/msw/entity-browser-fixtures";

const noopSupplier: AuthenticationTokenSupplier = async () => null;

// ----------------------------------------------------------------
// Router + provider factories
// ----------------------------------------------------------------

function createTestRouter(
  initialEntry = "/",
  seedQueryClient?: (queryClient: QueryClient) => void,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  seedQueryClient?.(queryClient);
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Providers({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  const rootRoute = createRootRoute({
    component: () => (
      <Providers>
        <Outlet />
      </Providers>
    ),
  });
  // EntityListLayout is a pathless layout route that wraps all content routes
  const appRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "_app",
    component: EntityListLayout,
  });
  const indexRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/",
    component: EntityOverviewPage,
  });
  // Entity gate: /$entity — resolves the profile once for both children below,
  // mirroring apps/*/routes/_app/$entity.tsx.
  const entityGateRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "/$entity",
    component: EntityProfileGate,
  });
  // Entity detail route: /$entity/ — renders EntityDetailPage
  const entityRoute = createRoute({
    getParentRoute: () => entityGateRoute,
    path: "/",
    component: EntityDetailPage,
    validateSearch: entitySearchStateValidator,
  });
  // Item detail route: /$entity/$itemId — renders EntityItemDetailPage
  const itemRoute = createRoute({
    getParentRoute: () => entityGateRoute,
    path: "/$itemId",
    component: EntityItemDetailPage,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([
      appRoute.addChildren([indexRoute, entityGateRoute.addChildren([entityRoute, itemRoute])]),
    ]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
}

export function renderEntityList(
  initialEntry = "/",
  seedQueryClient?: (queryClient: QueryClient) => void,
) {
  const router = createTestRouter(initialEntry, seedQueryClient);
  return render(<RouterProvider router={router} />);
}
