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
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(contentFixture)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.attributes.find((a) => a.name === "document")?.type).toBe(
      "content",
    );
  });

  it("normalises inline string options to { value, prompt } pairs on a search property", async () => {
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
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(withInlineOptions)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const statusProp = result.current.data!.searchProperties.find((p) => p.name === "status");
    // Plain strings are formatted with formatWords so users see "Draft" not "draft".
    expect(statusProp?.options?.inline).toEqual([
      { value: "draft", prompt: "Draft" },
      { value: "sent", prompt: "Sent" },
      { value: "paid", prompt: "Paid" },
    ]);
  });

  it("formats plain-string option prompts with formatWords so 'in_progress' becomes 'In Progress'", async () => {
    const withUnderscoreOptions = {
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
              options: { inline: ["draft", "in_progress", "done"] },
            },
          ],
        },
      },
    };

    server.use(
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(withUnderscoreOptions)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const statusProp = result.current.data!.searchProperties.find((p) => p.name === "status");
    expect(statusProp?.options?.inline).toEqual([
      { value: "draft", prompt: "Draft" },
      { value: "in_progress", prompt: "In Progress" },
      { value: "done", prompt: "Done" },
    ]);
  });

  it("preserves explicit server-provided prompts on object-form inline options", async () => {
    const withObjectOptions = {
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
              options: {
                inline: [
                  { value: "draft", prompt: "Draft (unsubmitted)" },
                  { value: "sent" }, // no explicit prompt → format value
                ],
              },
            },
          ],
        },
      },
    };

    server.use(
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(withObjectOptions)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const statusProp = result.current.data!.searchProperties.find((p) => p.name === "status");
    expect(statusProp?.options?.inline).toEqual([
      { value: "draft", prompt: "Draft (unsubmitted)" }, // server label preserved
      { value: "sent", prompt: "Sent" }, // value formatted since no explicit prompt
    ]);
  });

  it("carries options.link on a search property when the template has a remote link", async () => {
    const withRemoteOptions = {
      ...profileFixture,
      _templates: {
        ...profileFixture._templates,
        search: {
          method: "GET",
          target: `${BASE}/invoices`,
          properties: [
            {
              name: "category",
              prompt: "Category",
              type: "text",
              options: { link: { href: `${BASE}/categories` } },
            },
          ],
        },
      },
    };

    server.use(
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(withRemoteOptions)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const categoryProp = result.current.data!.searchProperties.find((p) => p.name === "category");
    expect(categoryProp?.options?.link).toEqual({ href: `${BASE}/categories` });
    expect(categoryProp?.options?.inline).toBeUndefined();
  });

  it("carries createFormFields with required/readOnly from the create-form template", async () => {
    server.use(
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(profileFixture)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const fields = result.current.data!.createFormFields;
    // "number" is in the create-form template as type "text", required true
    const numberField = fields.find((f) => f.name === "number");
    expect(numberField).toBeDefined();
    expect(numberField?.required).toBe(true);
    expect(numberField?.type).toBe("text");
    // "customer" is type "url" → goes into createFormRelations, not createFormFields
    expect(fields.find((f) => f.name === "customer")).toBeUndefined();
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
      http.get(`${BASE}/profile`, () => HttpResponse.json(mockProfileResponse())),
      http.get(PROFILE_HREF, () => HttpResponse.json(withStringSortOptions)),
    );

    const { result } = renderHook(() => useEntitySchema("invoice"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data!.sortOptions).toHaveLength(2);
    expect(result.current.data!.sortOptions[0].property).toBe("number");
    expect(result.current.data!.sortOptions[0].value).toBe("number,asc");
  });
});
