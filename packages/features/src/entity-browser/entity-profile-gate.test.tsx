import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { server } from "../../test-setup";
import { EntityProfileGate } from "./entity-profile-gate";
import { PROFILE_URL, invoiceProfileHandler, profileRootHandler } from "./test-support";

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function renderGate(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={PROFILE_URL}
        >
          <Outlet />
        </NavigatorDataProvider>
      </QueryClientProvider>
    ),
  });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>home</div>,
  });
  const entityGateRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/$entity",
    component: EntityProfileGate,
  });
  const entityRoute = createRoute({
    getParentRoute: () => entityGateRoute,
    path: "/",
    component: () => <div>entity content</div>,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, entityGateRoute.addChildren([entityRoute])]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });

  return render(<RouterProvider router={router} />);
}

describe("EntityProfileGate", () => {
  beforeEach(() => {
    server.use(profileRootHandler(), invoiceProfileHandler());
  });

  it("renders the outlet content once the profile resolves", async () => {
    renderGate("/invoice");

    expect(await screen.findByText("entity content")).toBeInTheDocument();
  });

  it("shows an unknown-entity error page, with a working back-to-home action", async () => {
    const user = userEvent.setup();

    renderGate("/not-a-real-entity");

    expect(
      await screen.findByText('"not-a-real-entity" is not a known entity.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to home" }));

    expect(await screen.findByText("home")).toBeInTheDocument();
  });

  it("shows a retriable error (not 'not a known entity') when the profile root fetch fails", async () => {
    server.use(http.get(PROFILE_URL, () => HttpResponse.json(null, { status: 500 })));

    renderGate("/invoice");

    expect(await screen.findByText(/Failed to load "invoice"/)).toBeInTheDocument();
    expect(screen.queryByText(/is not a known entity/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("recovers when Retry is clicked after the profile root fetch succeeds", async () => {
    // The first failure is rootQuery's own fetch; the query becoming enabled
    // immediately triggers one automatic self-heal attempt (a transient-blip
    // recovery) before the user ever sees the error — so the mock must fail
    // twice before the explicit Retry click succeeds on the third call.
    let callCount = 0;
    server.use(
      http.get(PROFILE_URL, () => {
        callCount += 1;
        if (callCount <= 2) return HttpResponse.json(null, { status: 500 });
        return HttpResponse.json({
          _links: {
            self: { href: PROFILE_URL },
            curies: [
              {
                name: "cg",
                href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
                templated: true,
              },
            ],
            "cg:entity": [{ href: `${PROFILE_URL}/invoices`, name: "invoice", title: "Invoice" }],
          },
        });
      }),
      invoiceProfileHandler(),
    );
    const user = userEvent.setup();

    renderGate("/invoice");

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("entity content")).toBeInTheDocument();
  });
});
