import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";
import type { UseUnsavedChangesGuardResult } from "./use-unsaved-changes-guard";

function FormPage({
  isDirty,
  onGuardReady,
}: Readonly<{ isDirty: boolean; onGuardReady?: (guard: UseUnsavedChangesGuardResult) => void }>) {
  const guard = useUnsavedChangesGuard(isDirty);
  onGuardReady?.(guard);
  return (
    <div data-testid="form-page">
      {guard.isBlocked && (
        <div role="alertdialog">
          <button type="button" onClick={guard.confirmNavigation}>
            Leave
          </button>
          <button type="button" onClick={guard.cancelNavigation}>
            Stay
          </button>
        </div>
      )}
    </div>
  );
}

/** Two real routes — sufficient for `router.navigate` to trigger a real blocked transition. */
function makeTestRouter(
  isDirty: boolean,
  onGuardReady?: (guard: UseUnsavedChangesGuardResult) => void,
) {
  const rootRoute = createRootRoute();
  const formRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/form",
    component: () => <FormPage isDirty={isDirty} onGuardReady={onGuardReady} />,
  });
  const otherRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/other",
    component: () => <div data-testid="other-page" />,
  });
  const routeTree = rootRoute.addChildren([formRoute, otherRoute]);
  return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/form"] }) });
}

/**
 * Renders and waits for the form route to actually mount before returning —
 * `useUnsavedChangesGuard`'s effect (which registers the blocker via
 * `history.block`) only commits after that mount. Navigating immediately
 * after a bare `render()` call races that effect and silently sails through
 * unblocked, since no blocker has been registered yet.
 */
async function renderAtForm(router: ReturnType<typeof makeTestRouter>) {
  render(<RouterProvider router={router} />);
  await waitFor(() => expect(screen.getByTestId("form-page")).toBeVisible());
}

describe("useUnsavedChangesGuard", () => {
  it("does not block navigation while not dirty", async () => {
    const router = makeTestRouter(false);
    await renderAtForm(router);

    await router.navigate({ to: "/other" });

    await waitFor(() => expect(screen.getByTestId("other-page")).toBeVisible());
  });

  it("blocks navigation while dirty, until the user confirms leaving", async () => {
    const router = makeTestRouter(true);
    await renderAtForm(router);

    router.navigate({ to: "/other" });

    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeVisible());
    expect(screen.queryByTestId("other-page")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /leave/i }));

    await waitFor(() => expect(screen.getByTestId("other-page")).toBeVisible());
  });

  it("stays on the page when the user cancels", async () => {
    const router = makeTestRouter(true);
    await renderAtForm(router);

    router.navigate({ to: "/other" });

    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeVisible());

    await userEvent.click(screen.getByRole("button", { name: /stay/i }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.queryByTestId("other-page")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/form");
  });

  it("lets a navigation through when triggered inside withoutBlocking", async () => {
    let guard: UseUnsavedChangesGuardResult | undefined;
    const router = makeTestRouter(true, (g) => {
      guard = g;
    });
    await renderAtForm(router);

    guard!.withoutBlocking(() => router.navigate({ to: "/other" }));

    await waitFor(() => expect(screen.getByTestId("other-page")).toBeVisible());
  });

  it("does not leave blocking disarmed for a later navigation when the action inside withoutBlocking never navigates", async () => {
    let guard: UseUnsavedChangesGuardResult | undefined;
    const router = makeTestRouter(true, (g) => {
      guard = g;
    });
    await renderAtForm(router);

    // A no-op — mirrors an onCreated callback that doesn't navigate (e.g. omitted).
    guard!.withoutBlocking(() => {});

    router.navigate({ to: "/other" });

    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeVisible());
    expect(screen.queryByTestId("other-page")).not.toBeInTheDocument();
  });
});
