import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { ProfileAttributeSearchType } from "../accessors/attribute-profile";
import { type AuthenticationTokenSupplier, createApiClient } from "../api/client";
import { NavigatorDataProvider, useNavigatorData } from "./context";
import { useProfileEntities, useProfileEntity } from "./use-profile-entity";

const PROFILE_URL = "https://api.example.com/profile";

const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const apiFetch = createApiClient(noopSupplier);

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider apiFetch={apiFetch} profileUrl={PROFILE_URL}>
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  };
}

describe("useProfile", () => {
  it("returns entity list parsed from the profile response", async () => {
    server.use(
      http.get(PROFILE_URL, () =>
        HttpResponse.json({
          _links: {
            self: { href: PROFILE_URL },
            "cg:entity": [
              {
                href: "https://api.example.com/profile/invoices",
                name: "invoice",
                title: "Invoice",
              },
              {
                href: "https://api.example.com/profile/customers",
                name: "customer",
                title: "Customer",
              },
            ],
            curies: [
              {
                href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
                name: "cg",
                templated: true,
              },
            ],
          },
          _templates: {},
        }),
      ),
    );

    const { result } = renderHook(() => useProfileEntities(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toMatchObject({
      name: "invoice",
      title: "Invoice",
      href: "https://api.example.com/profile/invoices",
      collectionHref: "https://api.example.com/invoices",
    });
  });

  it("surfaces ProblemDetailError when the profile endpoint returns an error", async () => {
    server.use(
      http.get(PROFILE_URL, () =>
        HttpResponse.json(
          { status: 401, title: "Unauthorized" },
          { status: 401, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const { result } = renderHook(() => useProfileEntities(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it("uses href-derived name when link.name is absent", async () => {
    server.use(
      http.get(PROFILE_URL, () =>
        HttpResponse.json({
          _links: {
            self: { href: PROFILE_URL },
            // cg:entity link with NO name field — name should be derived from href
            "cg:entity": [{ href: "https://api.example.com/profile/orders", title: "Order" }],
            curies: [
              {
                href: "https://contentgrid.cloud/rels/contentgrid/{rel}",
                name: "cg",
                templated: true,
              },
            ],
          },
          _templates: {},
        }),
      ),
    );

    const { result } = renderHook(() => useProfileEntities(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toHaveLength(1);
    // Name should be derived from the last segment of the href
    expect(result.current.data![0].name).toBe("orders");
    expect(result.current.data![0].collectionLink.href).toBe("https://api.example.com/orders");
  });
});

describe("useNavigatorData", () => {
  it("throws when used outside NavigatorDataProvider", () => {
    // Wrap in a QueryClient provider only — no NavigatorDataProvider
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    expect(() => renderHook(() => useNavigatorData(), { wrapper })).toThrow(
      "useNavigatorData must be used within <NavigatorDataProvider>",
    );
  });
});

describe("useEntityProfile (Profile)", () => {
  const BASE = "https://api.example.com";
  const INVOICE_PROFILE_HREF = `${BASE}/profile/invoices`;

  const mockProfileRoot = () => ({
    _links: {
      self: { href: PROFILE_URL },
      "cg:entity": [{ href: INVOICE_PROFILE_HREF, name: "invoice", title: "Invoice" }],
      curies: [
        { href: "https://contentgrid.cloud/rels/contentgrid/{rel}", name: "cg", templated: true },
      ],
    },
    _templates: {},
  });

  const mockInvoiceProfile = () => ({
    name: "invoice",
    title: "Invoice",
    description: "An invoice document",
    _links: {
      self: { href: INVOICE_PROFILE_HREF },
      describes: [
        {
          href: `${BASE}/invoices`,
          name: "collection",
          title: "Invoices",
          profile: INVOICE_PROFILE_HREF,
        },
        { href: `${BASE}/invoices/{id}`, name: "item", title: "Invoice", templated: true },
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
      "blueprint:attribute": [
        {
          name: "id",
          title: "ID",
          type: "string",
          readOnly: true,
          _embedded: {
            "blueprint:constraint": [],
            "blueprint:search-param": [],
            "blueprint:attribute": [],
          },
          _links: {},
        },
        {
          name: "invoice_number",
          title: "Invoice Number",
          type: "string",
          readOnly: false,
          _embedded: {
            "blueprint:constraint": [{ type: "unique" }],
            "blueprint:search-param": [
              { name: "invoice_number", title: "Invoice Number", type: "exact-match" },
              { name: "invoice_number~prefix", title: "Invoice Number", type: "prefix-match" },
            ],
            "blueprint:attribute": [],
          },
          _links: {},
        },
        {
          name: "status",
          title: "Status",
          type: "string",
          _embedded: {
            "blueprint:constraint": [{ type: "allowed-values", values: ["draft", "sent", "paid"] }],
            "blueprint:search-param": [{ name: "status", title: "Status", type: "exact-match" }],
            "blueprint:attribute": [],
          },
          _links: {},
        },
        {
          name: "created_by",
          title: "Created By",
          type: "string",
          readOnly: true,
          _embedded: {
            "blueprint:constraint": [{ type: "created-by" }],
            "blueprint:search-param": [],
            "blueprint:attribute": [],
          },
          _links: {},
        },
        {
          name: "created_date",
          title: "Created Date",
          type: "datetime",
          readOnly: true,
          _embedded: {
            "blueprint:constraint": [{ type: "created-date" }],
            "blueprint:search-param": [],
            "blueprint:attribute": [],
          },
          _links: {},
        },
        {
          name: "modified_by",
          title: "Modified By",
          type: "string",
          readOnly: true,
          _embedded: {
            "blueprint:constraint": [{ type: "modified-by" }],
            "blueprint:search-param": [],
            "blueprint:attribute": [],
          },
          _links: {},
        },
        {
          name: "modified_date",
          title: "Modified Date",
          type: "datetime",
          readOnly: true,
          _embedded: {
            "blueprint:constraint": [{ type: "modified-date" }],
            "blueprint:search-param": [],
            "blueprint:attribute": [],
          },
          _links: {},
        },
      ],
      "blueprint:relation": [
        {
          name: "customer",
          title: "Customer",
          many_source_per_target: false,
          many_target_per_source: true,
          required: false,
          _links: {
            "blueprint:target-entity": { href: `${BASE}/profile/customers`, title: "Customer" },
          },
        },
        {
          name: "line_items",
          title: "Line Items",
          many_source_per_target: true,
          many_target_per_source: false,
          required: false,
          _links: {
            "blueprint:target-entity": { href: `${BASE}/profile/line-items`, title: "Line Item" },
          },
        },
        {
          name: "contact_person",
          title: "Contact Person",
          many_source_per_target: true,
          many_target_per_source: true,
          required: false,
          _links: {
            "blueprint:target-entity": { href: `${BASE}/profile/contacts`, title: "Contact" },
          },
        },
      ],
    },
    _templates: {
      default: { method: "HEAD", properties: [] },
      search: {
        method: "GET",
        target: `${BASE}/invoices`,
        properties: [
          { name: "invoice_number~prefix", prompt: "Invoice Number", type: "text" },
          { name: "status", prompt: "Status", type: "text" },
          {
            name: "_sort",
            prompt: "Sort",
            type: "text",
            options: {
              inline: [
                {
                  value: "invoice_number,asc",
                  property: "invoice_number",
                  direction: "asc",
                  prompt: "Invoice Number A→Z",
                },
                {
                  value: "invoice_number,desc",
                  property: "invoice_number",
                  direction: "desc",
                  prompt: "Invoice Number Z→A",
                },
              ],
            },
          },
        ],
      },
      "create-form": {
        method: "POST",
        target: `${BASE}/invoices`,
        contentType: "application/json",
        properties: [
          { name: "invoice_number", prompt: "Invoice Number", type: "text", required: true },
          { name: "status", prompt: "Status", type: "text", required: true },
        ],
      },
    },
  });

  it("returns Profile with basic properties", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(mockProfileRoot())),
      http.get(INVOICE_PROFILE_HREF, () => HttpResponse.json(mockInvoiceProfile())),
    );

    const { result } = renderHook(() => useProfileEntity({ name: "invoice" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const accessor = result.current.data!;
    expect(accessor.name).toBe("invoice");
    expect(accessor.title).toBe("Invoice");
    expect(accessor.description).toBe("An invoice document");
    expect(accessor.singularName).toBe("invoice");
    expect(accessor.pluralName).toBe("Invoices");
  });

  it("provides access to all attributes", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(mockProfileRoot())),
      http.get(INVOICE_PROFILE_HREF, () => HttpResponse.json(mockInvoiceProfile())),
    );

    const { result } = renderHook(() => useProfileEntity({ name: "invoice" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const accessor = result.current.data!;
    expect(accessor.attributes).toHaveLength(7);
    expect(accessor.attributes.map((a) => a.name)).toEqual([
      "id",
      "invoice_number",
      "status",
      "created_by",
      "created_date",
      "modified_by",
      "modified_date",
    ]);
  });

  it("filters user-defined attributes (excludes id and audit)", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(mockProfileRoot())),
      http.get(INVOICE_PROFILE_HREF, () => HttpResponse.json(mockInvoiceProfile())),
    );

    const { result } = renderHook(() => useProfileEntity({ name: "invoice" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const accessor = result.current.data!;
    expect(accessor.userDefinedAttributes).toHaveLength(2);
    expect(accessor.userDefinedAttributes.map((a) => a.name)).toEqual(["invoice_number", "status"]);
    expect(accessor.userDefinedAttributeNames).toEqual(new Set(["invoice_number", "status"]));
  });

  it("provides audit attributes separately", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(mockProfileRoot())),
      http.get(INVOICE_PROFILE_HREF, () => HttpResponse.json(mockInvoiceProfile())),
    );

    const { result } = renderHook(() => useProfileEntity({ name: "invoice" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const accessor = result.current.data!;
    expect(accessor.auditAttributes).toHaveLength(4);
    expect(accessor.auditAttributes.map((a) => a.name)).toEqual([
      "created_by",
      "created_date",
      "modified_by",
      "modified_date",
    ]);
    expect(accessor.auditAttributeNames).toEqual(
      new Set(["created_by", "created_date", "modified_by", "modified_date"]),
    );

    expect(accessor.createdByAttribute?.name).toBe("created_by");
    expect(accessor.createdAtAttribute?.name).toBe("created_date");
    expect(accessor.modifiedByAttribute?.name).toBe("modified_by");
    expect(accessor.modifiedAtAttribute?.name).toBe("modified_date");
  });

  it("provides access to all relations", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(mockProfileRoot())),
      http.get(INVOICE_PROFILE_HREF, () => HttpResponse.json(mockInvoiceProfile())),
    );

    const { result } = renderHook(() => useProfileEntity({ name: "invoice" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const accessor = result.current.data!;
    expect(accessor.relations).toHaveLength(3);
    expect(accessor.relations.map((r) => r.name)).toEqual([
      "customer",
      "line_items",
      "contact_person",
    ]);
    expect(accessor.relationNames).toEqual(new Set(["customer", "line_items", "contact_person"]));
  });

  it("filters to-one and to-many relations", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(mockProfileRoot())),
      http.get(INVOICE_PROFILE_HREF, () => HttpResponse.json(mockInvoiceProfile())),
    );

    const { result } = renderHook(() => useProfileEntity({ name: "invoice" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const accessor = result.current.data!;

    // to-one: many_target_per_source = false
    expect(accessor.toOneRelations).toHaveLength(1);
    expect(accessor.toOneRelations[0].name).toBe("line_items");

    // to-many: many_target_per_source = true
    expect(accessor.toManyRelations).toHaveLength(2);
    expect(accessor.toManyRelations.map((r) => r.name)).toEqual(["customer", "contact_person"]);
  });

  it("provides cardinality helpers on relations", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(mockProfileRoot())),
      http.get(INVOICE_PROFILE_HREF, () => HttpResponse.json(mockInvoiceProfile())),
    );

    const { result } = renderHook(() => useProfileEntity({ name: "invoice" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const accessor = result.current.data!;

    const customerRel = accessor.getRelation("customer")!;
    expect(customerRel.isToMany).toBe(true);
    expect(customerRel.isToOne).toBe(false);
    expect(customerRel.isOneToMany).toBe(true);
    expect(customerRel.isManyToMany).toBe(false);

    const lineItemsRel = accessor.getRelation("line_items")!;
    expect(lineItemsRel.isToMany).toBe(false);
    expect(lineItemsRel.isToOne).toBe(true);
    expect(lineItemsRel.isManyToOne).toBe(true);
    expect(lineItemsRel.isOneToOne).toBe(false);

    const contactRel = accessor.getRelation("contact_person")!;
    expect(contactRel.isToMany).toBe(true);
    expect(contactRel.isManyToMany).toBe(true);
  });

  it("provides HAL links for collection and item", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(mockProfileRoot())),
      http.get(INVOICE_PROFILE_HREF, () => HttpResponse.json(mockInvoiceProfile())),
    );

    const { result } = renderHook(() => useProfileEntity({ name: "invoice" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const accessor = result.current.data!;
    expect(accessor.collectionLink?.href).toBe(`${BASE}/invoices`);
    expect(accessor.itemLink?.href).toBe(`${BASE}/invoices/{id}`);
  });

  it("provides enhanced search template with ProfileAttribute metadata", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(mockProfileRoot())),
      http.get(INVOICE_PROFILE_HREF, () => HttpResponse.json(mockInvoiceProfile())),
    );

    const { result } = renderHook(() => useProfileEntity({ name: "invoice" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const accessor = result.current.data!;
    const searchTemplate = accessor.searchTemplate!;

    expect(searchTemplate).toBeDefined();
    // SearchHalFormTemplate class exposes searchProperties (excludes _sort)
    expect(searchTemplate.searchProperties).toHaveLength(2);

    // Check enhanced search property
    const invoiceNumberProp = searchTemplate.searchProperties.find(
      (p) => p.property.name === "invoice_number~prefix",
    );
    expect(invoiceNumberProp?.profileAttribute?.name).toBe("invoice_number");
    expect(invoiceNumberProp?.isOverRelation).toBe(false);
    expect(invoiceNumberProp?.searchType).toBe(ProfileAttributeSearchType.prefixMatch);

    // Check sort options with ProfileAttribute metadata
    expect(searchTemplate.sortOptions).toHaveLength(2);
    const firstSort = searchTemplate.sortOptions![0];
    expect(firstSort?.value).toBe("invoice_number,asc");
    expect(firstSort?.direction).toBe("asc");
    expect(firstSort?.profileAttribute?.name).toBe("invoice_number");
  });

  it("provides create template", async () => {
    server.use(
      http.get(PROFILE_URL, () => HttpResponse.json(mockProfileRoot())),
      http.get(INVOICE_PROFILE_HREF, () => HttpResponse.json(mockInvoiceProfile())),
    );

    const { result } = renderHook(() => useProfileEntity({ name: "invoice" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const accessor = result.current.data!;
    const createTemplate = accessor.createTemplate;

    // CreateHalFormTemplate wraps the underlying template
    expect(createTemplate).toBeDefined();
    expect(createTemplate?.template).toBeDefined();
    expect(createTemplate?.userDefinedProperties).toBeDefined();
    expect(createTemplate?.relationProperties).toBeDefined();
  });

  it("returns null when entity is not found", async () => {
    server.use(http.get(PROFILE_URL, () => HttpResponse.json(mockProfileRoot())));

    const { result } = renderHook(() => useProfileEntity({ name: "nonexistent" }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toBeNull();
  });
});
