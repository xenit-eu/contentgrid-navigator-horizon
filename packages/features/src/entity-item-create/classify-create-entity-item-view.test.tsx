import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import {
  PROFILE_URL,
  invoiceProfileHandler,
  invoiceProfileHandlerNoCreate,
  profileRootHandler,
} from "@contentgrid/navigator-data/test-fixtures/msw/entity-browser-fixtures";
import { server } from "../../test-setup";
import { ClassifyCreateEntityItemView } from "./classify-create-entity-item-view";

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function renderView(onSelect = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={createApiClient(noopSupplier)}
          contentFetch={createContentClient(noopSupplier)}
          profileUrl={PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }
  render(<ClassifyCreateEntityItemView onSelect={onSelect} onCancel={vi.fn()} />, {
    wrapper: Wrapper,
  });
}

describe("ClassifyCreateEntityItemView", () => {
  it("enables Continue once an entity is chosen and passes that entity on", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    server.use(profileRootHandler(), invoiceProfileHandler());
    renderView(onSelect);

    const continueButton = await screen.findByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();

    await user.click(await screen.findByRole("radio", { name: /Invoice/ }));
    await user.click(continueButton);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: "invoice" }));
  });

  it("says there is nothing to create when no entity has a create form", async () => {
    server.use(profileRootHandler(), invoiceProfileHandlerNoCreate());
    renderView();

    expect(await screen.findByText("There is nothing you can create.")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });
});
