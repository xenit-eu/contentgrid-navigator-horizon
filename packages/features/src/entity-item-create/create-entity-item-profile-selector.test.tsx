import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
  useCreatableProfileEntities,
} from "@contentgrid/navigator-data";
import {
  PROFILE_URL,
  customerProfileHandler,
  invoiceProfileHandler,
  profileRootWithTwoEntitiesHandler,
} from "@contentgrid/navigator-data/test-fixtures/msw/entity-browser-fixtures";
import { server } from "../../test-setup";
import { CreateEntityItemProfileSelector } from "./create-entity-item-profile-selector";

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
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

function InvoiceSelector({ onSelect }: Readonly<{ onSelect: (profile: ProfileEntity) => void }>) {
  const { profiles } = useCreatableProfileEntities();
  const invoice = profiles.find(({ name }) => name === "invoice");
  return invoice ? (
    <CreateEntityItemProfileSelector selectedProfile={invoice} onSelect={onSelect} />
  ) : null;
}

describe("CreateEntityItemProfileSelector", () => {
  it("passes on the creatable entity chosen in the selector", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    server.use(
      profileRootWithTwoEntitiesHandler(),
      invoiceProfileHandler(),
      customerProfileHandler({ creatable: true }),
    );
    render(<InvoiceSelector onSelect={onSelect} />, { wrapper: Wrapper });

    await user.click(await screen.findByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Customer/ }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: "customer" }));
  });
});
