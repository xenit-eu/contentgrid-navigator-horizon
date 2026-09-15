/**
 * Regression test for the 412 `unsatisfied-version` reload toast (see
 * `../../problem-details/notify-version-conflict.ts`).
 *
 * The toast used to be raised from a `useEffect` keyed on the mutation's `error`
 * field, which double-fired under React StrictMode's intentional double-invoke
 * of effects. It is now raised from the mutation's own `onError` (wired via
 * `onRelationMutationError` in `./relation-shared`), which TanStack Query only
 * ever calls once per failed mutation attempt — this test renders the tree
 * inside `<StrictMode>` to prove that.
 */
import { type ReactNode, StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type EntityItemToOneRelation,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import {
  makeEntityItem,
  makeProfileEntity,
} from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { toast } from "@contentgrid/ui";
import { server } from "../../../test-setup";
import { RelationToOneSection } from "./relation-to-one-section";

// notifyReloadOnUnsatisfiedVersion calls @contentgrid/ui's `toast` (sonner's `toast`
// re-exported as-is). Mock only `toast` — every other @contentgrid/ui export stays real.
vi.mock("@contentgrid/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/ui")>();
  return {
    ...actual,
    toast: { error: vi.fn() },
  };
});

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;
const INVOICE_PROFILE_URL = `${API_URL}/profile/invoices`;
const SUPPLIER_PROFILE_URL = `${API_URL}/profile/suppliers`;
const INVOICE_ITEM_URL = `${API_URL}/invoices/inv-001`;
const SUPPLIER_RELATION_URL = `${INVOICE_ITEM_URL}/supplier`;

const BLUEPRINT_RELATION_REL = "https://contentgrid.cloud/rels/blueprint/relation";
const BLUEPRINT_TARGET_ENTITY_REL = "https://contentgrid.cloud/rels/blueprint/target-entity";
const CG_RELATION_REL = "https://contentgrid.cloud/rels/contentgrid/relation";

const noopSupplier: AuthenticationTokenSupplier = async () => null;

// ---------------------------------------------------------------------------
// Fixture bodies — profile root + invoice/supplier profiles + invoice item.
// Only what useProfileEntities() and EntityItem.getToOneRelation() need to
// resolve a real `supplier` to-one relation with a `clear-supplier` template.
// ---------------------------------------------------------------------------

const profileRootBody = {
  _links: {
    self: { href: PROFILE_URL },
    "cg:entity": [
      { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" },
      { href: SUPPLIER_PROFILE_URL, name: "supplier", title: "Supplier" },
    ],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

const supplierProfileJson = {
  name: "supplier",
  title: "Supplier",
  description: "",
  _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
  _links: {
    self: { href: SUPPLIER_PROFILE_URL, title: "Supplier" },
    describes: [
      { href: SUPPLIER_PROFILE_URL },
      { href: `${API_URL}/suppliers`, name: "collection" },
      { href: `${API_URL}/suppliers/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _templates: {},
};

const invoiceProfileJson = {
  name: "invoice",
  title: "Invoice",
  description: "",
  _links: {
    self: { href: INVOICE_PROFILE_URL },
    describes: [
      { href: `${API_URL}/invoices`, name: "collection" },
      { href: `${API_URL}/invoices/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _embedded: {
    [BLUEPRINT_RELATION_REL]: [
      {
        name: "supplier",
        title: "Supplier",
        description: "",
        required: false,
        many_source_per_target: false,
        many_target_per_source: false,
        _links: {
          self: { href: `${INVOICE_PROFILE_URL}/relations/supplier` },
          [BLUEPRINT_TARGET_ENTITY_REL]: {
            href: SUPPLIER_PROFILE_URL,
            name: "supplier",
            title: "Supplier",
          },
        },
      },
    ],
  },
  _templates: {},
};

const invoiceItemJson = {
  id: "inv-001",
  _links: {
    self: { href: INVOICE_ITEM_URL },
    [CG_RELATION_REL]: [{ href: SUPPLIER_RELATION_URL, name: "supplier" }],
  },
  _templates: {
    "clear-supplier": {
      method: "DELETE",
      target: SUPPLIER_RELATION_URL,
      properties: [],
    },
  },
};

const supplierItemJson = {
  id: "sup-001",
  name: "Acme Corp",
  _links: { self: { href: `${API_URL}/suppliers/sup-001` } },
};

function buildSupplierRelation(): EntityItemToOneRelation {
  const invoiceProfile = makeProfileEntity(invoiceProfileJson, INVOICE_PROFILE_URL, "invoice");
  const invoiceItem = makeEntityItem(invoiceItemJson, invoiceProfile, '"v1"');
  const relation = invoiceItem.getToOneRelation("supplier");
  if (!relation) throw new Error("expected a supplier to-one relation on the invoice fixture");
  return relation;
}

function setupHandlers() {
  server.use(
    http.get(PROFILE_URL, () => HttpResponse.json(profileRootBody)),
    http.get(INVOICE_PROFILE_URL, () => HttpResponse.json(invoiceProfileJson)),
    http.get(SUPPLIER_PROFILE_URL, () => HttpResponse.json(supplierProfileJson)),
    http.get(SUPPLIER_RELATION_URL, () => HttpResponse.json(supplierItemJson)),
    http.delete(SUPPLIER_RELATION_URL, () =>
      HttpResponse.json(
        {
          status: 412,
          title: "Version conflict",
          detail: "This item was changed by someone else.",
          type: "https://contentgrid.cloud/problems/unsatisfied-version",
        },
        { status: 412, headers: { "Content-Type": "application/problem+json" } },
      ),
    ),
  );
}

function renderSection(props: {
  relation: EntityItemToOneRelation;
  profiles: readonly ProfileEntity[];
  onReload?: () => void;
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <NavigatorDataProvider
            apiFetch={apiFetch}
            contentFetch={contentFetch}
            profileUrl={PROFILE_URL}
          >
            {children}
          </NavigatorDataProvider>
        </QueryClientProvider>
      </StrictMode>
    );
  }

  return render(<RelationToOneSection {...props} />, { wrapper: Wrapper });
}

describe("RelationToOneSection — 412 unsatisfied-version reload toast", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("toasts exactly once when clearing hits a 412, even inside React.StrictMode", async () => {
    setupHandlers();
    const relation = buildSupplierRelation();
    const profiles = [makeProfileEntity(supplierProfileJson, SUPPLIER_PROFILE_URL, "supplier")];
    const onReload = vi.fn();
    const user = userEvent.setup();

    renderSection({ relation, profiles, onReload });

    // Wait for the linked supplier item to resolve — only then does the Unlink trigger render.
    await user.click(await screen.findByRole("button", { name: "Unlink" }));

    // Confirm inside the AlertDialog (scoped — the trigger button behind it is also named "Unlink").
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Unlink" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(onReload).not.toHaveBeenCalled(); // the toast's Reload action fires it, not the mutation itself
  });
});
