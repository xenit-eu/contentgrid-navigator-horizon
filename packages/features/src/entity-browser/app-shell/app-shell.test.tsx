import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  demoInvoiceItems,
  demoSupplierItems,
} from "@contentgrid/navigator-data/test-fixtures/msw/demo-fixtures";
import { server } from "../../../test-setup";
import {
  PROFILE_URL,
  collectionHandler,
  pendingHandler,
  problemHandler,
  renderEntityBrowser,
  useDefaultHandlers,
} from "../test-utils";
import { AppShell } from "./app-shell";

// AppShell's UserMenu reads the OIDC session via useAppAuth; everything else
// (useProfile etc.) stays real and goes through MSW.
const { signoutRedirect, removeUser } = vi.hoisted(() => ({
  signoutRedirect: vi.fn(() => Promise.resolve()),
  removeUser: vi.fn(() => Promise.resolve()),
}));

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useAppAuth: () => ({
      auth: {
        user: {
          profile: { name: "Nick Van Vynckt", email: "nick@example.com" },
        },
        signoutRedirect,
        removeUser,
      },
      apiFetch: undefined,
      profileUrl: PROFILE_URL,
    }),
  };
});

function renderShell() {
  return renderEntityBrowser("/", {
    home: () => (
      <AppShell>
        <div data-testid="shell-content">page content</div>
      </AppShell>
    ),
    collection: ({ collection }) => (
      <AppShell>
        <div data-testid="collection-page">{collection}</div>
      </AppShell>
    ),
  });
}

describe("AppShell", () => {
  it("renders the branded header, user identity and main content", async () => {
    useDefaultHandlers(demoInvoiceItems as unknown as Record<string, unknown>[]);
    renderShell();

    expect(await screen.findByTestId("shell-content")).toBeInTheDocument();
    expect(screen.getByText("BY AMEXIO")).toBeInTheDocument();
    expect(screen.getByText("Nick Van Vynckt")).toBeInTheDocument();
    expect(screen.getByText("nick@example.com")).toBeInTheDocument();
    // Initials derived from the display name
    expect(screen.getByText("NV")).toBeInTheDocument();
  });

  it("renders a sidebar nav item per profile entity", async () => {
    useDefaultHandlers(demoInvoiceItems as unknown as Record<string, unknown>[]);
    server.use(collectionHandler("suppliers", demoSupplierItems as never));
    renderShell();

    expect(await screen.findByRole("link", { name: /Invoice/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Supplier/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create/ })).toBeInTheDocument();
  });

  it("navigates to a collection when a sidebar entity is clicked", async () => {
    useDefaultHandlers(demoInvoiceItems as unknown as Record<string, unknown>[]);
    server.use(collectionHandler("suppliers", demoSupplierItems as never));
    const { router } = renderShell();
    const user = userEvent.setup();

    const link = await screen.findByRole("link", { name: /Invoice/ });
    await user.click(link);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/invoice");
    });
    expect(await screen.findByTestId("collection-page")).toHaveTextContent("invoice");
  });

  it("renders nav skeletons while the profile loads and nothing on error", async () => {
    server.use(pendingHandler(PROFILE_URL));
    renderShell();

    expect(await screen.findByTestId("shell-content")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Invoice/ })).not.toBeInTheDocument();
  });

  it("renders no nav items when the profile fails", async () => {
    server.use(problemHandler(PROFILE_URL, 500));
    renderShell();

    expect(await screen.findByTestId("shell-content")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /Invoice/ })).not.toBeInTheDocument();
    });
  });

  it("signs the user out from the user menu", async () => {
    useDefaultHandlers(demoInvoiceItems as unknown as Record<string, unknown>[]);
    renderShell();
    const user = userEvent.setup();

    await screen.findByText("Nick Van Vynckt");
    await user.click(screen.getByRole("button", { name: /Nick Van Vynckt/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Sign out/ }));

    expect(signoutRedirect).toHaveBeenCalledTimes(1);
  });
});
