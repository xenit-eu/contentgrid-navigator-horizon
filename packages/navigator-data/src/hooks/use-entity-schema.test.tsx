import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import {
  BASE,
  INVOICE_ENTITY,
  ROOT_URL,
  makeWrapper,
  mockProfileResponse,
  mockRootResponse,
} from "./test-utils";
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
      http.get(ROOT_URL, () => HttpResponse.json(mockRootResponse())),
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

  it("detects content attribute when object sub-attrs include filename, mimetype, length", async () => {
    const contentFixture = {
      ...profileFixture,
      _embedded: {
        "blueprint:attribute": [
          {
            name: "document",
            title: "Document",
            type: "object",
            _embedded: {
              "blueprint:constraint": [],
              "blueprint:search-param": [],
              "blueprint:attribute": [
                {
                  name: "filename",
                  type: "string",
                  _embedded: {
                    "blueprint:constraint": [],
                    "blueprint:search-param": [],
                    "blueprint:attribute": [],
                  },
                  _links: {},
                },
                {
                  name: "mimetype",
                  type: "string",
                  _embedded: {
                    "blueprint:constraint": [],
                    "blueprint:search-param": [],
                    "blueprint:attribute": [],
                  },
                  _links: {},
                },
                {
                  name: "length",
                  type: "long",
                  _embedded: {
                    "blueprint:constraint": [],
                    "blueprint:search-param": [],
                    "blueprint:attribute": [],
                  },
                  _links: {},
                },
              ],
            },
            _links: {},
          },
        ],
        "blueprint:relation": [],
      },
    };

    server.use(
      http.get(ROOT_URL, () => HttpResponse.json(mockRootResponse())),
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(contentFixture)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.attributes.find((a) => a.name === "document")?.type).toBe(
      "content",
    );
  });

  it("includes inline options on a search property when they are all strings", async () => {
    const withInlineOptions = {
      ...profileFixture,
      _templates: {
        ...profileFixture._templates,
        search: {
          method: "GET",
          target: `${BASE}/invoices`,
          properties: [
            {
              name: "status",
              prompt: "Status",
              type: "text",
              options: { inline: ["draft", "sent", "paid"] },
            },
          ],
        },
      },
    };

    server.use(
      http.get(ROOT_URL, () => HttpResponse.json(mockRootResponse())),
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(withInlineOptions)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const statusProp = result.current.data!.searchProperties.find((p) => p.name === "status");
    expect(statusProp?.options?.inline).toEqual(["draft", "sent", "paid"]);
  });

  it("parses sort options given as plain strings (value,asc format)", async () => {
    const withStringSortOptions = {
      ...profileFixture,
      _templates: {
        ...profileFixture._templates,
        search: {
          method: "GET",
          target: `${BASE}/invoices`,
          properties: [
            {
              name: "_sort",
              type: "text",
              options: { inline: ["number,asc", "number,desc"] },
            },
          ],
        },
      },
    };

    server.use(
      http.get(ROOT_URL, () => HttpResponse.json(mockRootResponse())),
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(withStringSortOptions)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.sortOptions).toHaveLength(2);
    expect(result.current.data!.sortOptions[0].property).toBe("number");
    expect(result.current.data!.sortOptions[0].value).toBe("number,asc");
  });

  it("prefers options.link.name over the href path segment for targetEntityName", async () => {
    const withNamedLink = {
      ...profileFixture,
      _templates: {
        ...profileFixture._templates,
        "create-form": {
          method: "POST",
          target: `${BASE}/invoices`,
          contentType: "application/json",
          properties: [
            {
              name: "customer",
              prompt: "Customer",
              type: "url",
              maxItems: 1,
              options: {
                // name is the authoritative entity name — href segment differs on purpose
                link: { href: `${BASE}/legacy-customers`, name: "customer" },
                minItems: 0,
                valueField: "/_links/self/href",
              },
            },
          ],
        },
      },
    };

    server.use(
      http.get(ROOT_URL, () => HttpResponse.json(mockRootResponse())),
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(withNamedLink)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const rel = result.current.data!.createFormRelations[0];
    // link.name wins over the href's last path segment ("legacy-customers")
    expect(rel.targetEntityName).toBe("customer");
    expect(rel.manyToOne).toBe(true);
  });

  it("falls back to the href path segment for targetEntityName when link.name is absent", async () => {
    server.use(
      http.get(ROOT_URL, () => HttpResponse.json(mockRootResponse())),
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      // The base profileFixture's create-form customer link has href only (no name)
      http.get(PROFILE_HREF, () => HttpResponse.json(profileFixture)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const rel = result.current.data!.createFormRelations[0];
    // No name on the link → last path segment of the href (documented fallback)
    expect(rel.targetEntityName).toBe("customers");
  });

  it("returns empty attributes and relations when the profile has no _embedded", async () => {
    const withoutEmbedded = {
      name: "invoice",
      title: "Invoice",
      _links: profileFixture._links,
      _templates: { default: { method: "HEAD", properties: [] } },
    };

    server.use(
      http.get(ROOT_URL, () => HttpResponse.json(mockRootResponse())),
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(withoutEmbedded)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.attributes).toEqual([]);
    expect(result.current.data!.relations).toEqual([]);
    expect(result.current.data!.searchProperties).toEqual([]);
    expect(result.current.data!.createFormRelations).toEqual([]);
  });
});
