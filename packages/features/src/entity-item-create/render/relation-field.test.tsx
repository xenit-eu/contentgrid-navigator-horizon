import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { server } from "../../../test-setup";
import type { FieldDescriptor } from "../model/field-descriptor";
import { resolveCreateFieldDescriptors } from "../model/resolve-create-field-descriptors";
import { RelationField } from "./relation-field";

const API_URL = "https://api.example.com";
const ROOT_PROFILE_URL = `${API_URL}/profile`;
const SUPPLIER_PROFILE_URL = `${API_URL}/profile/suppliers`;
const SUPPLIER_COLLECTION_URL = `${API_URL}/suppliers`;
const SUPPLIER_1_URL = `${SUPPLIER_COLLECTION_URL}/1`;
const PRODUCT_PROFILE_URL = `${API_URL}/profile/products`;
const PRODUCT_COLLECTION_URL = `${API_URL}/products`;
const PRODUCT_1_URL = `${PRODUCT_COLLECTION_URL}/1`;
const PRODUCT_2_URL = `${PRODUCT_COLLECTION_URL}/2`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function targetProfileJson(name: string, profileUrl: string, collectionUrl: string) {
  return {
    name,
    title: name,
    _links: {
      self: { href: profileUrl },
      describes: [
        { href: collectionUrl, name: "collection" },
        { href: `${collectionUrl}/{id}`, name: "item", templated: true },
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
          name: "name",
          title: "Name",
          type: "string",
          readOnly: false,
          _embedded: {
            "blueprint:constraint": [],
            "blueprint:search-param": [{ name: "name~prefix", type: "prefix-match" }],
          },
          _links: {},
        },
      ],
      "blueprint:relation": [],
    },
    _templates: {
      default: { method: "HEAD", target: collectionUrl, properties: [] },
      search: {
        method: "GET",
        target: collectionUrl,
        properties: [{ name: "name~prefix", type: "text" }],
      },
      "create-form": {
        method: "POST",
        target: collectionUrl,
        contentType: "application/json",
        properties: [],
      },
    },
  };
}

/** The profile whose create-form owns the relation fields under test — real descriptors, no fakes. */
const INVOICE_PROFILE = makeProfileEntity(
  {
    name: "invoice",
    title: "invoice",
    _links: {
      self: { href: `${API_URL}/profile/invoices` },
      describes: [{ href: `${API_URL}/invoices`, name: "collection" }],
    },
    _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
    _templates: {
      "create-form": {
        method: "POST",
        target: `${API_URL}/invoices`,
        contentType: "application/json",
        properties: [
          {
            name: "supplier",
            prompt: "Supplier",
            type: "url",
            options: { link: { href: SUPPLIER_COLLECTION_URL }, maxItems: 1 },
          },
          {
            name: "products",
            prompt: "Products",
            type: "url",
            options: { link: { href: PRODUCT_COLLECTION_URL } },
          },
        ],
      },
    },
  },
  `${API_URL}/profile/invoices`,
  "invoice",
);
const FIELDS = resolveCreateFieldDescriptors(INVOICE_PROFILE.createTemplate!).fields;
const relationField = (name: string) =>
  FIELDS.find((field) => field.name === name) as Extract<FieldDescriptor, { kind: "relation" }>;

function relationItem(collectionUrl: string, id: string, name: string) {
  return { id, name, _links: { self: { href: `${collectionUrl}/${id}` } } };
}

const rootProfileJson = {
  _links: {
    self: { href: ROOT_PROFILE_URL },
    "cg:entity": [
      { href: SUPPLIER_PROFILE_URL, name: "supplier", title: "Supplier" },
      { href: PRODUCT_PROFILE_URL, name: "product", title: "Product" },
    ],
    curies: [
      { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
    ],
  },
  _templates: {},
};

function setupHandlers() {
  server.use(
    http.get(ROOT_PROFILE_URL, () => HttpResponse.json(rootProfileJson)),
    http.get(SUPPLIER_PROFILE_URL, () =>
      HttpResponse.json(
        targetProfileJson("supplier", SUPPLIER_PROFILE_URL, SUPPLIER_COLLECTION_URL),
      ),
    ),
    http.get(PRODUCT_PROFILE_URL, () =>
      HttpResponse.json(targetProfileJson("product", PRODUCT_PROFILE_URL, PRODUCT_COLLECTION_URL)),
    ),
    http.get(SUPPLIER_COLLECTION_URL, () =>
      HttpResponse.json({
        _embedded: { supplier: [relationItem(SUPPLIER_COLLECTION_URL, "1", "Acme Corp")] },
        _links: { self: { href: SUPPLIER_COLLECTION_URL } },
        page: { size: 1, total_items_exact: 1 },
      }),
    ),
    http.get(SUPPLIER_1_URL, () =>
      HttpResponse.json(relationItem(SUPPLIER_COLLECTION_URL, "1", "Acme Corp")),
    ),
    http.get(PRODUCT_COLLECTION_URL, () =>
      HttpResponse.json({
        _embedded: {
          product: [
            relationItem(PRODUCT_COLLECTION_URL, "1", "Widget A"),
            relationItem(PRODUCT_COLLECTION_URL, "2", "Widget B"),
          ],
        },
        _links: { self: { href: PRODUCT_COLLECTION_URL } },
        page: { size: 2, total_items_exact: 2 },
      }),
    ),
    http.get(PRODUCT_1_URL, () =>
      HttpResponse.json(relationItem(PRODUCT_COLLECTION_URL, "1", "Widget A")),
    ),
    http.get(PRODUCT_2_URL, () =>
      HttpResponse.json(relationItem(PRODUCT_COLLECTION_URL, "2", "Widget B")),
    ),
  );
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={ROOT_PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }
  return Wrapper;
}

function renderRelationField(props: Partial<Parameters<typeof RelationField>[0]> = {}) {
  setupHandlers();
  return render(
    <RelationField field={relationField("supplier")} value="" onChange={vi.fn()} {...props} />,
    { wrapper: makeWrapper() },
  );
}

describe("RelationField — to-one", () => {
  it("links the clicked item's href and marks the field touched", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    renderRelationField({ onChange, onBlur });

    await user.click(await screen.findByRole("button", { name: "Link" }));
    const [option] = await within(await screen.findByRole("dialog")).findAllByText("Acme Corp");
    await user.click(option!);

    expect(onChange).toHaveBeenCalledWith(SUPPLIER_1_URL);
    expect(onBlur).toHaveBeenCalled();
  });

  it("shows the linked item's summary and clears it on Unlink", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRelationField({ value: SUPPLIER_1_URL, onChange });

    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("shows an error alert whose Remove clears a linked item that fails to load", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const missingUrl = `${SUPPLIER_COLLECTION_URL}/missing`;
    server.use(http.get(missingUrl, () => new HttpResponse(null, { status: 404 })));
    renderRelationField({ value: missingUrl, onChange });

    expect(await screen.findByText(/Invalid item detected/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("RelationField — to-many", () => {
  const products = () => relationField("products");

  it("shows a row per linked href", async () => {
    renderRelationField({ field: products(), value: [PRODUCT_1_URL, PRODUCT_2_URL] });
    expect((await screen.findAllByText("Widget A")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Widget B")).length).toBeGreaterThan(0);
  });

  it("opens the picker with nothing checked and adds new picks, skipping already-linked ones", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRelationField({ field: products(), value: [PRODUCT_1_URL], onChange });

    await screen.findAllByText("Widget A");
    await user.click(screen.getByRole("button", { name: "Link" }));
    const dialog = await screen.findByRole("dialog");
    // Header "select all", then Widget A (already linked), then Widget B.
    const [, widgetA, widgetB] = await within(dialog).findAllByRole("checkbox");
    expect(widgetA).not.toBeChecked();
    await user.click(widgetA!);
    await user.click(widgetB!);
    await user.click(within(dialog).getByRole("button", { name: "Link entity items" }));

    expect(onChange).toHaveBeenCalledWith([PRODUCT_1_URL, PRODUCT_2_URL]);
  });

  it("removes only that row's href on 'Remove from selection'", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRelationField({ field: products(), value: [PRODUCT_1_URL, PRODUCT_2_URL], onChange });

    await screen.findAllByText("Widget B");
    const [removeFirst] = screen.getAllByRole("button", { name: "Remove from selection" });
    await user.click(removeFirst!);
    expect(onChange).toHaveBeenCalledWith([PRODUCT_2_URL]);
  });

  it("shows an error alert whose Remove drops a linked href that fails to load", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const missingUrl = `${PRODUCT_COLLECTION_URL}/missing`;
    server.use(http.get(missingUrl, () => new HttpResponse(null, { status: 404 })));
    renderRelationField({ field: products(), value: [PRODUCT_1_URL, missingUrl], onChange });

    expect(await screen.findByText(/Invalid item detected/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith([PRODUCT_1_URL]);
  });

  it("hides the failed item's Remove when the field is read-only", async () => {
    const missingUrl = `${PRODUCT_COLLECTION_URL}/missing`;
    server.use(http.get(missingUrl, () => new HttpResponse(null, { status: 404 })));
    renderRelationField({ field: { ...products(), readOnly: true }, value: [missingUrl] });

    expect(await screen.findByText(/Invalid item detected/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});
