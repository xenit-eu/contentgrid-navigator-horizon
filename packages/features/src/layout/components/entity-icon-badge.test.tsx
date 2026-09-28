import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { useEntityDisplayPreferencesStore } from "../../preferences/entity-display-preferences-store";
import { EntityIconBadge } from "./entity-icon-badge";

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
      ],
      "blueprint:relation": [],
    },
    _templates: {},
  };
}

function renderEntityIconBadge(props: Omit<Parameters<typeof EntityIconBadge>[0], "profile">) {
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

  return render(<EntityIconBadge profile={profile} {...props} />, { wrapper: Wrapper });
}

afterEach(() => {
  localStorage.clear();
  useEntityDisplayPreferencesStore.setState({ overrides: {} });
});

describe("EntityIconBadge", () => {
  it("renders the entity's heuristic default icon", () => {
    const { container } = renderEntityIconBadge({});
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders as a non-interactive span when no onClick is given", () => {
    const { container } = renderEntityIconBadge({});
    const badge = container.querySelector('[data-slot="icon-badge"]');
    expect(badge?.tagName).toBe("SPAN");
  });

  it("renders as a button and calls onClick when given", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderEntityIconBadge({ onClick });

    await user.click(screen.getByRole("button", { name: "Invoices" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("labels the button with the entity's plural name by default", () => {
    renderEntityIconBadge({ onClick: vi.fn() });
    expect(screen.getByRole("button", { name: "Invoices" })).toBeInTheDocument();
  });

  it("accepts an aria-label override", () => {
    renderEntityIconBadge({ onClick: vi.fn(), "aria-label": "Change icon and color" });
    expect(screen.getByRole("button", { name: "Change icon and color" })).toBeInTheDocument();
  });

  it("defaults muted to false", () => {
    const { container } = renderEntityIconBadge({});
    expect(container.querySelector('[data-slot="icon-badge"]')).toHaveClass("text-white");
  });

  it("forwards muted to the underlying IconBadge", () => {
    const { container } = renderEntityIconBadge({ muted: true });
    expect(container.querySelector('[data-slot="icon-badge"]')).not.toHaveClass("text-white");
  });

  it("forwards variant to the underlying IconBadge", () => {
    const { container } = renderEntityIconBadge({ variant: "lg" });
    expect(container.querySelector('[data-slot="icon-badge"]')).toHaveAttribute(
      "data-variant",
      "lg",
    );
  });

  it("tints the background with the entity's overridden color", () => {
    useEntityDisplayPreferencesStore
      .getState()
      .setOverride(PROFILE_URL, "invoice", { color: "oklch(0.55 0.17 155)" });

    const { container } = renderEntityIconBadge({});
    const badge = container.querySelector('[data-slot="icon-badge"]') as HTMLElement;
    expect(badge.style.backgroundColor).toBe(
      "color-mix(in oklch, oklch(0.55 0.17 155) 65%, transparent)",
    );
  });
});
