import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { useEntityDisplayPreferencesStore } from "./entity-display-preferences-store";
import { useEntityDisplayPreferences } from "./use-entity-display-preferences";

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

function renderUseEntityDisplayPreferences(profileUrl = PROFILE_URL) {
  const profileEntity = makeProfileEntity(invoiceProfileJson(), INVOICE_PROFILE_URL, "invoice");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={profileUrl}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  return renderHook(() => useEntityDisplayPreferences(profileEntity), { wrapper: Wrapper });
}

afterEach(() => {
  localStorage.clear();
  useEntityDisplayPreferencesStore.setState({ overrides: {} }, true);
});

describe("useEntityDisplayPreferences", () => {
  it("falls back to the heuristic default when no backend or user override exists", () => {
    const { result } = renderUseEntityDisplayPreferences();

    expect(result.current.preferences.nameAttribute).toBe("invoice_number");
    expect(result.current.nameAttribute?.name).toBe("invoice_number");
    expect(result.current.preferences.visibleColumns).toEqual(["id", "invoice_number"]);
  });

  it("a user override wins over the heuristic default", () => {
    useEntityDisplayPreferencesStore.getState().setOverride(PROFILE_URL, "invoice", {
      nameAttribute: "id",
      color: "blue",
    });

    const { result } = renderUseEntityDisplayPreferences();

    expect(result.current.preferences.nameAttribute).toBe("id");
    expect(result.current.nameAttribute?.name).toBe("id");
    expect(result.current.preferences.color).toBe("blue");
    // visibleColumns wasn't overridden — the heuristic default still applies underneath.
    expect(result.current.preferences.visibleColumns).toEqual(["id", "invoice_number"]);
  });

  it("scopes overrides per backend — the same entity on a different profileUrl is unaffected", () => {
    useEntityDisplayPreferencesStore.getState().setOverride(PROFILE_URL, "invoice", {
      color: "blue",
    });

    const { result } = renderUseEntityDisplayPreferences(
      "https://other-backend.example.com/profile",
    );

    expect(result.current.preferences.color).toBeUndefined();
  });

  it("setOverride persists a new override that a subsequent render picks up", () => {
    const { result, rerender } = renderUseEntityDisplayPreferences();
    expect(result.current.preferences.icon).toBeUndefined();

    act(() => result.current.setOverride({ icon: "file-text" }));
    rerender();

    expect(result.current.preferences.icon).toBe("file-text");
  });
});
