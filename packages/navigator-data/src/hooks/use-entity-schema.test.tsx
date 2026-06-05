import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { BASE, INVOICE_ENTITY, makeWrapper, mockProfileResponse } from "./test-utils";
import { useEntitySchema } from "./use-entity-schema";

// Derived from INVOICE_ENTITY so it stays consistent if the entity URL changes.
const PROFILE_HREF = INVOICE_ENTITY.href;

const profileFixture = {
  name: "invoice",
  title: "Invoice",
  _links: {
    self: { href: PROFILE_HREF },
    describes: [
      { href: `${BASE}/invoices`, name: "collection" },
      { href: `${BASE}/invoices/{id}`, name: "item", templated: true },
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
        title: "id",
        type: "string",
        readOnly: true,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "number",
        title: "Number",
        type: "string",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "number~prefix", title: "Number", type: "prefix-match" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "status",
        title: "Status",
        type: "string",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [{ type: "allowed-values", values: ["draft", "sent", "paid"] }],
          "blueprint:search-param": [{ name: "status", title: "Status", type: "exact-match" }],
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
        _links: { "blueprint:target-entity": { href: `${BASE}/profile/customers` } },
      },
    ],
  },
  _templates: {
    default: { method: "HEAD", properties: [] },
    search: {
      method: "GET",
      target: `${BASE}/invoices`,
      properties: [
        { name: "number~prefix", prompt: "Number", type: "text" },
        { name: "status", prompt: "Status", type: "text" },
        {
          name: "_sort",
          prompt: "Sort",
          type: "text",
          options: {
            inline: [
              { value: "number,asc", property: "number", direction: "asc", prompt: "Number A→Z" },
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
        { name: "number", prompt: "Number", type: "text", required: true },
        {
          name: "customer",
          prompt: "Customer",
          type: "url",
          options: {
            link: { href: `${BASE}/customers` },
            minItems: 0,
            valueField: "/_links/self/href",
          },
        },
      ],
    },
  },
};

describe("useEntitySchema", () => {
  it("parses attributes, relations, searchProperties and sortOptions from profile", async () => {
    server.use(
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(profileFixture)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const schema = result.current.data!;
    expect(schema.attributes.map((a) => a.name)).toContain("number");
    expect(schema.attributes.find((a) => a.name === "status")?.allowedValues).toEqual([
      "draft",
      "sent",
      "paid",
    ]);
    expect(schema.relations[0].name).toBe("customer");
    expect(schema.searchProperties.some((p) => p.name === "number~prefix")).toBe(true);
    expect(schema.sortOptions[0].property).toBe("number");
    expect(schema.createFormRelations[0].name).toBe("customer");
  });

  it("is not enabled when entity is not in profile", () => {
    const { result } = renderHook(() => useEntitySchema("nonexistent"), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
