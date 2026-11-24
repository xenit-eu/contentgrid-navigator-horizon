import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type EntityItem,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
  useEntityItemCollection,
} from "@contentgrid/navigator-data";
import { server } from "../../test-setup";
import { useEntityDisplayPreferencesStore } from "../preferences";
import {
  INVOICE_COLLECTION_URL,
  INVOICE_PROFILE_URL,
  invoiceCollectionBody,
  makeInvoiceProfile,
} from "../test-fixtures/invoice-collection";
import { EntityItemTitleCell } from "./entity-item-title-cell";

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(async () => null);
  const contentFetch = createContentClient(async () => null);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={INVOICE_PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  };
}

async function fetchInvoices(): Promise<EntityItem[]> {
  server.use(http.get(INVOICE_COLLECTION_URL, () => HttpResponse.json(invoiceCollectionBody())));
  const profile = makeInvoiceProfile();
  const { result } = renderHook(() => useEntityItemCollection({ profileEntity: profile }), {
    wrapper: makeWrapper(),
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  useEntityDisplayPreferencesStore
    .getState()
    .setOverride(INVOICE_PROFILE_URL, "invoice", { nameAttribute: "reference" });
  return [...result.current.data!.items];
}

afterEach(() => {
  localStorage.clear();
  useEntityDisplayPreferencesStore.setState({ overrides: {} });
});

describe("EntityItemTitleCell", () => {
  it("shows the title, a file tile and the file's name and size", async () => {
    const [withFile] = await fetchInvoices();
    const { container } = render(<EntityItemTitleCell item={withFile} />, {
      wrapper: makeWrapper(),
    });

    expect(await screen.findByText("INV-2026-04812")).toBeInTheDocument();
    expect(screen.getByText("document.pdf · 412.0 kB")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="file-tile"]')).toBeInTheDocument();
  });

  it('says "No file" when the item has no file, still with the neutral file tile', async () => {
    const [, withoutFile] = await fetchInvoices();
    const { container } = render(<EntityItemTitleCell item={withoutFile} />, {
      wrapper: makeWrapper(),
    });

    expect(await screen.findByText("No file")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="file-tile"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="icon-badge"]')).not.toBeInTheDocument();
  });

  it("uses the first content attribute that holds a file", async () => {
    const [withFile] = await fetchInvoices();
    render(<EntityItemTitleCell item={withFile} />, { wrapper: makeWrapper() });

    expect(await screen.findByText(/^document\.pdf/)).toBeInTheDocument();
    expect(screen.queryByText(/terms\.pdf/)).not.toBeInTheDocument();
  });

  it("is plain bold text, not a link, when no way to open the item is given", async () => {
    const [withFile] = await fetchInvoices();
    render(<EntityItemTitleCell item={withFile} />, { wrapper: makeWrapper() });

    await screen.findByText("INV-2026-04812");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is a real link when an href is given, and a plain click opens the item without reaching the row", async () => {
    const user = userEvent.setup();
    const [withFile] = await fetchInvoices();
    const onOpen = vi.fn();
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <EntityItemTitleCell item={withFile} onOpen={onOpen} href="/invoice/1" />
      </div>,
      { wrapper: makeWrapper() },
    );

    const link = await screen.findByRole("link", { name: "INV-2026-04812" });
    expect(link).toHaveAttribute("href", "/invoice/1");
    await user.click(link);
    expect(onOpen).toHaveBeenCalledWith(withFile);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("leaves a modified click on the link to the browser, still not reaching the row", async () => {
    const user = userEvent.setup();
    const [withFile] = await fetchInvoices();
    const onOpen = vi.fn();
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <EntityItemTitleCell item={withFile} onOpen={onOpen} href="/invoice/1" />
      </div>,
      { wrapper: makeWrapper() },
    );

    const link = await screen.findByRole("link");
    // Stop jsdom from trying to navigate on the (unprevented) link click.
    link.addEventListener("click", (event) => event.preventDefault());
    await user.keyboard("{Control>}");
    await user.click(link);
    await user.keyboard("{/Control}");
    expect(onOpen).not.toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("lets the browser follow the link when there is no onOpen, still not reaching the row", async () => {
    const [withFile] = await fetchInvoices();
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <EntityItemTitleCell item={withFile} href="/invoice/1" />
      </div>,
      { wrapper: makeWrapper() },
    );

    const link = await screen.findByRole("link");
    // fireEvent returns false when the click's default was prevented.
    const defaultAllowed = fireEvent.click(link);
    expect(defaultAllowed).toBe(true);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("is a button when the host has no address for the item", async () => {
    const user = userEvent.setup();
    const [withFile] = await fetchInvoices();
    const onOpen = vi.fn();
    render(<EntityItemTitleCell item={withFile} onOpen={onOpen} />, { wrapper: makeWrapper() });

    await user.click(await screen.findByRole("button", { name: "INV-2026-04812" }));
    expect(onOpen).toHaveBeenCalledWith(withFile);
  });
});
