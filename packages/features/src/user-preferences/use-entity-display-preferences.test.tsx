import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityDisplayPreferences,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { UserPreferencesProvider, createMemoryStorage, createUserPreferencesStore } from "./index";
import { useEntityDisplayPreferences } from "./use-entity-display-preferences";

// The backend part still returns nothing; this stands in for it so the middle layer can be tested.
let backendDefaults: Record<string, Partial<EntityDisplayPreferences>> = {};
vi.mock("@contentgrid/navigator-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@contentgrid/navigator-data")>()),
  useEntityDisplayDefaults: () => ({ data: backendDefaults }),
}));

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
        <UserPreferencesProvider store={preferencesStore}>
          <NavigatorDataProvider
            apiFetch={apiFetch}
            contentFetch={contentFetch}
            profileUrl={profileUrl}
          >
            {children}
          </NavigatorDataProvider>
        </UserPreferencesProvider>
      </QueryClientProvider>
    );
  }

  return renderHook(() => useEntityDisplayPreferences(profileEntity), { wrapper: Wrapper });
}

function createTestPreferencesStore() {
  return createUserPreferencesStore({ storage: createMemoryStorage() });
}

let preferencesStore = createTestPreferencesStore();

afterEach(() => {
  localStorage.clear();
  preferencesStore = createTestPreferencesStore();
  backendDefaults = {};
});

describe("useEntityDisplayPreferences", () => {
  it("falls back to the heuristic default when no backend or user override exists", () => {
    const { result } = renderUseEntityDisplayPreferences();

    expect(result.current.preferences.nameAttribute).toBe("invoice_number");
    expect(result.current.nameAttribute?.name).toBe("invoice_number");
    expect(result.current.preferences.visibleColumns).toEqual(["id", "invoice_number"]);
    // The invoice fixture has no content attribute, so the heuristic default is "Database".
    expect(result.current.preferences.icon).toBe("Database");
  });

  it("a user override wins over the heuristic default", () => {
    preferencesStore.getState().setOverride(PROFILE_URL, "invoice", {
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
    preferencesStore.getState().setOverride(PROFILE_URL, "invoice", {
      color: "blue",
    });

    const { result } = renderUseEntityDisplayPreferences(
      "https://other-backend.example.com/profile",
    );

    expect(result.current.preferences.color).toBeUndefined();
  });

  it("setOverride persists a new override that a subsequent render picks up", () => {
    const { result, rerender } = renderUseEntityDisplayPreferences();
    // Heuristic default before any override — never undefined.
    expect(result.current.preferences.icon).toBe("Database");

    act(() => result.current.setOverride({ icon: "file-text" }));
    rerender();

    expect(result.current.preferences.icon).toBe("file-text");
  });

  describe("layer priority: user override > backend default > heuristic default", () => {
    it("a backend default wins over the heuristic default", () => {
      backendDefaults = { invoice: { nameAttribute: "id", color: "green" } };

      const { result } = renderUseEntityDisplayPreferences();

      expect(result.current.preferences.nameAttribute).toBe("id");
      expect(result.current.preferences.color).toBe("green");
      // Not set by the backend: the heuristic default shows through.
      expect(result.current.preferences.visibleColumns).toEqual(["id", "invoice_number"]);
    });

    it("a user override wins over the backend default, field by field", () => {
      backendDefaults = { invoice: { nameAttribute: "id", color: "green" } };
      preferencesStore.getState().setOverride(PROFILE_URL, "invoice", { color: "blue" });

      const { result } = renderUseEntityDisplayPreferences();

      expect(result.current.preferences.color).toBe("blue");
      // The user did not touch the name attribute, so the backend value still applies.
      expect(result.current.preferences.nameAttribute).toBe("id");
    });

    it("still applies user overrides when nothing else supplies a value", () => {
      preferencesStore.getState().setOverride(PROFILE_URL, "invoice", { color: "blue" });

      const { result } = renderUseEntityDisplayPreferences();

      expect(result.current.preferences.color).toBe("blue");
      expect(result.current.preferences.icon).toBe("Database");
    });
  });
});
