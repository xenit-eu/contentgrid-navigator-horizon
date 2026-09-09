import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { useEntityDisplayPreferencesStore } from "../entity-display-preferences-store";
import { EntityConfigurationDetail } from "./entity-configuration-detail";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;
const INVOICE_PROFILE_URL = `${PROFILE_URL}/invoices`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function invoiceProfileJson() {
  return {
    name: "invoice",
    title: "Invoice",
    _links: {
      self: { href: INVOICE_PROFILE_URL },
      describes: [
        { href: `${API_URL}/invoices`, name: "collection", title: "Invoices" },
        { href: `${API_URL}/invoices/{id}`, name: "item", title: "Invoice", templated: true },
      ],
      curies: [
        {
          name: "blueprint",
          href: "https://contentgrid.cloud/rels/blueprint/{rel}",
          templated: true,
        },
      ],
    },
    _embedded: {
      "blueprint:attribute": [
        {
          name: "id",
          title: "ID",
          type: "string",
          readOnly: true,
          _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
          _links: {},
        },
        {
          name: "invoice_number",
          title: "Invoice Number",
          type: "string",
          readOnly: false,
          _embedded: { "blueprint:constraint": [], "blueprint:search-param": [] },
          _links: {},
        },
      ],
      "blueprint:relation": [],
    },
    _templates: {},
  };
}

function renderDetail(onClose = vi.fn()) {
  const profile = makeProfileEntity(invoiceProfileJson(), INVOICE_PROFILE_URL, "invoice");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
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

  return render(<EntityConfigurationDetail profile={profile} onClose={onClose} />, {
    wrapper: Wrapper,
  });
}

afterEach(() => {
  localStorage.clear();
  useEntityDisplayPreferencesStore.setState({ overrides: {} });
});

describe("EntityConfigurationDetail", () => {
  it("renders the entity's plural name as the title", () => {
    renderDetail();
    expect(screen.getByRole("heading", { level: 1, name: "Invoices" })).toBeInTheDocument();
  });

  it("renders the eyebrow header", () => {
    renderDetail();
    expect(screen.getByText("Configure display")).toBeInTheDocument();
  });

  it("renders a description that names the entity", () => {
    renderDetail();
    expect(screen.getByText(/how Invoices are rendered./)).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDetail(onClose);

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("lists the id and user-defined attributes as name-attribute options", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("combobox", { name: "Name attribute" }));

    expect(screen.getByRole("option", { name: /^ID/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Invoice Number/ })).toBeInTheDocument();
  });

  it("lists the id and user-defined attributes as subtitle-attribute options", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("combobox", { name: "Subtitle attribute" }));

    expect(screen.getByRole("option", { name: /^ID/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Invoice Number/ })).toBeInTheDocument();
  });

  it("persists a subtitle-attribute override when an option is chosen", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("combobox", { name: "Subtitle attribute" }));
    await user.click(screen.getByRole("option", { name: /^Invoice Number/ }));

    await waitFor(() =>
      expect(
        useEntityDisplayPreferencesStore.getState().overrides[PROFILE_URL]?.invoice
          ?.subtitleAttribute,
      ).toBe("invoice_number"),
    );
  });

  it("lists the id and user-defined attributes as visible-column options", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("combobox", { name: "Visible columns" }));

    expect(screen.getByRole("checkbox", { name: /^ID/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /^Invoice Number/ })).toBeInTheDocument();
  });

  it("persists a visible-columns override when an option is chosen", async () => {
    // Start from an explicit empty override rather than relying on the heuristic
    // default (which may already mark columns visible), so the checkbox starts unchecked.
    useEntityDisplayPreferencesStore.getState().setOverride(PROFILE_URL, "invoice", {
      visibleColumns: [],
    });
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("combobox", { name: "Visible columns" }));
    await user.click(screen.getByRole("checkbox", { name: /^Invoice Number/ }));

    await waitFor(() =>
      expect(
        useEntityDisplayPreferencesStore.getState().overrides[PROFILE_URL]?.invoice?.visibleColumns,
      ).toEqual(["invoice_number"]),
    );
  });

  it("persists an icon override when a new icon is chosen", async () => {
    const user = userEvent.setup();
    renderDetail();

    // Heuristic default icon for a content-less fixture is "Database" (see
    // use-entity-display-preferences.test.tsx) — that's the trigger's label pre-selection.
    await user.click(screen.getByRole("button", { name: "Database" }));
    await user.click(await screen.findByTitle("Folder"));

    await waitFor(() =>
      expect(
        useEntityDisplayPreferencesStore.getState().overrides[PROFILE_URL]?.invoice?.icon,
      ).toBe("Folder"),
    );
  });

  it("persists a color override when a swatch is chosen", async () => {
    // The sidebar renders ColorPickerContent's swatch grid inline (no trigger/popover needed) —
    // clicking a swatch there directly, rather than opening the header's ColorPicker popover,
    // avoids a second ambiguous "Green" swatch when both are mounted at once.
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByTitle("Green"));

    await waitFor(() =>
      expect(
        useEntityDisplayPreferencesStore.getState().overrides[PROFILE_URL]?.invoice?.color,
      ).toBe("oklch(0.55 0.17 155)"),
    );
  });
});
