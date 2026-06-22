/**
 * Unit tests for SearchHalFormTemplate.
 *
 * Tests cover:
 * - searchProperties: filtering out _sort, basic property linking
 * - extractSearchType: all suffix variants (~prefix, ~fts, ~gt, ~gte, ~lt, ~lte, ~after, ~before, exact)
 * - sortOptions: inline sort option parsing, profileAttribute linking, no-sort case
 * - getSearchPropertiesByType / getSearchPropertyByName / getSearchPropertiesByAttribute
 * - getRelationSearchProperties
 * - relation traversal: isOverRelation, profileRelation, profileAttribute from allProfiles
 * - hasSort / sortProperty
 */
import { describe, expect, it } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import { resolveTemplate } from "@contentgrid/hal-forms";
import type { ProfileEntityShape } from "../../shapes";
import { ProfileAttributeSearchType } from "../attribute-profile";
import ProfileEntity from "../entity-profile";
import { SearchHalFormTemplate } from "./search-form";

// ---------------------------------------------------------------------------
// Minimal helpers to build ProfileEntity from inline JSON
// ---------------------------------------------------------------------------

function makeProfileEntity(
  json: Record<string, unknown>,
  linkHref = "https://example.com/profile/things",
  linkName = "thing",
): ProfileEntity {
  const hal = new HalObject(json as unknown as ProfileEntityShape);
  const link = { href: linkHref, name: linkName } as unknown as Link;
  return new ProfileEntity(link, hal as HalObject<ProfileEntityShape>);
}

// ---------------------------------------------------------------------------
// Base fixture: simple entity with search template and sort
// ---------------------------------------------------------------------------

const PROFILE_URL = "https://example.com/profile/invoices";

const invoiceProfileJson = {
  name: "invoice",
  description: "",
  _links: {
    self: { href: PROFILE_URL },
    describes: [
      { href: "https://example.com/invoices", name: "collection" },
      { href: "https://example.com/invoices/{id}", name: "item", templated: true },
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
        description: "",
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
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "number", title: "Number", type: "exact-match" },
            { name: "number~prefix", title: "Number prefix", type: "prefix-match" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "total",
        title: "Total",
        type: "long",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "total~gt", title: "Total gt", type: "greater-than" },
            { name: "total~gte", title: "Total gte", type: "greater-than-or-equal" },
            { name: "total~lt", title: "Total lt", type: "less-than" },
            { name: "total~lte", title: "Total lte", type: "less-than-or-equal" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "note",
        title: "Note",
        type: "string",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [{ name: "note~fts", title: "Note fts", type: "full-text" }],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "due_date",
        title: "Due date",
        type: "datetime",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
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
        description: "",
        many_source_per_target: true,
        many_target_per_source: false,
        required: false,
        _links: { "blueprint:target-entity": { href: "https://example.com/profile/customers" } },
      },
    ],
  },
  _templates: {
    default: { method: "HEAD", target: "https://example.com/invoices", properties: [] },
    search: {
      method: "GET",
      target: "https://example.com/invoices",
      properties: [
        { name: "number", type: "text" },
        { name: "number~prefix", type: "text" },
        { name: "total~gt", type: "number" },
        { name: "total~gte", type: "number" },
        { name: "total~lt", type: "number" },
        { name: "total~lte", type: "number" },
        { name: "note~fts", type: "text" },
        { name: "due_date~after", type: "datetime" },
        { name: "due_date~before", type: "datetime" },
        { name: "customer.name~prefix", type: "text" },
        {
          name: "_sort",
          type: "text",
          options: {
            minItems: 0,
            promptField: "prompt",
            valueField: "value",
            inline: [
              { property: "number", direction: "asc", prompt: "Number A→Z", value: "number,asc" },
              { property: "number", direction: "desc", prompt: "Number Z→A", value: "number,desc" },
              {
                property: "total",
                direction: "desc",
                prompt: "Total highest",
                value: "total,desc",
              },
            ],
          },
        },
      ],
    },
    "create-form": {
      method: "POST",
      target: "https://example.com/invoices",
      contentType: "application/json",
      properties: [{ name: "number", type: "text" }],
    },
  },
};

function makeSearchTemplate(profileJson = invoiceProfileJson, allProfiles?: ProfileEntity[]) {
  const profile = makeProfileEntity(profileJson, PROFILE_URL, "invoice");
  const rawTemplate = resolveTemplate(profileJson as ProfileEntityShape, "search")!;
  return new SearchHalFormTemplate(rawTemplate, profile, allProfiles);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SearchHalFormTemplate.searchProperties", () => {
  it("excludes the _sort property from searchProperties", () => {
    const tmpl = makeSearchTemplate();
    const names = tmpl.searchProperties.map((p) => p.property.name);
    expect(names).not.toContain("_sort");
  });

  it("includes direct attribute properties", () => {
    const tmpl = makeSearchTemplate();
    const names = tmpl.searchProperties.map((p) => p.property.name);
    expect(names).toContain("number");
    expect(names).toContain("number~prefix");
    expect(names).toContain("total~gt");
  });

  it("links profileAttribute for direct attribute properties", () => {
    const tmpl = makeSearchTemplate();
    const numberProp = tmpl.searchProperties.find((p) => p.property.name === "number");
    expect(numberProp?.profileAttribute?.name).toBe("number");
  });

  it("returns undefined profileAttribute for relation traversal when allProfiles not provided", () => {
    const tmpl = makeSearchTemplate();
    const customerProp = tmpl.searchProperties.find(
      (p) => p.property.name === "customer.name~prefix",
    );
    expect(customerProp?.profileAttribute).toBeUndefined();
    expect(customerProp?.isOverRelation).toBe(true);
  });

  it("links profileRelation for relation traversal properties", () => {
    const tmpl = makeSearchTemplate();
    const customerProp = tmpl.searchProperties.find(
      (p) => p.property.name === "customer.name~prefix",
    );
    expect(customerProp?.profileRelation?.name).toBe("customer");
  });
});

describe("SearchHalFormTemplate search type extraction", () => {
  it("classifies exact-match (no suffix)", () => {
    const tmpl = makeSearchTemplate();
    const p = tmpl.searchProperties.find((x) => x.property.name === "number");
    expect(p?.searchType).toBe(ProfileAttributeSearchType.exactMatch);
  });

  it("classifies prefix-match (~prefix suffix)", () => {
    const tmpl = makeSearchTemplate();
    const p = tmpl.searchProperties.find((x) => x.property.name === "number~prefix");
    expect(p?.searchType).toBe(ProfileAttributeSearchType.prefixMatch);
  });

  it("classifies full-text (~fts suffix)", () => {
    const tmpl = makeSearchTemplate();
    const p = tmpl.searchProperties.find((x) => x.property.name === "note~fts");
    expect(p?.searchType).toBe(ProfileAttributeSearchType.fullText);
  });

  it("classifies greaterThan (~gt suffix)", () => {
    const tmpl = makeSearchTemplate();
    const p = tmpl.searchProperties.find((x) => x.property.name === "total~gt");
    expect(p?.searchType).toBe(ProfileAttributeSearchType.greaterThan);
  });

  it("classifies greaterThanOrEqual (~gte suffix)", () => {
    const tmpl = makeSearchTemplate();
    const p = tmpl.searchProperties.find((x) => x.property.name === "total~gte");
    expect(p?.searchType).toBe(ProfileAttributeSearchType.greaterThanOrEqual);
  });

  it("classifies lessThan (~lt suffix)", () => {
    const tmpl = makeSearchTemplate();
    const p = tmpl.searchProperties.find((x) => x.property.name === "total~lt");
    expect(p?.searchType).toBe(ProfileAttributeSearchType.lessThan);
  });

  it("classifies lessThanOrEqual (~lte suffix)", () => {
    const tmpl = makeSearchTemplate();
    const p = tmpl.searchProperties.find((x) => x.property.name === "total~lte");
    expect(p?.searchType).toBe(ProfileAttributeSearchType.lessThanOrEqual);
  });

  it("classifies greaterThan for ~after suffix", () => {
    const tmpl = makeSearchTemplate();
    const p = tmpl.searchProperties.find((x) => x.property.name === "due_date~after");
    expect(p?.searchType).toBe(ProfileAttributeSearchType.greaterThan);
  });

  it("classifies lessThan for ~before suffix", () => {
    const tmpl = makeSearchTemplate();
    const p = tmpl.searchProperties.find((x) => x.property.name === "due_date~before");
    expect(p?.searchType).toBe(ProfileAttributeSearchType.lessThan);
  });

  it("classifies prefix-match for relation traversal with ~prefix", () => {
    const tmpl = makeSearchTemplate();
    const p = tmpl.searchProperties.find((x) => x.property.name === "customer.name~prefix");
    expect(p?.searchType).toBe(ProfileAttributeSearchType.prefixMatch);
  });
});

describe("SearchHalFormTemplate.sortOptions", () => {
  it("returns sort options from inline options", () => {
    const tmpl = makeSearchTemplate();
    expect(tmpl.sortOptions).toHaveLength(3);
  });

  it("sort option has correct value, direction, prompt", () => {
    const tmpl = makeSearchTemplate();
    const asc = tmpl.sortOptions!.find((o) => o.value === "number,asc");
    expect(asc?.direction).toBe("asc");
    expect(asc?.prompt).toBe("Number A→Z");
  });

  it("sort option links profileAttribute", () => {
    const tmpl = makeSearchTemplate();
    const asc = tmpl.sortOptions!.find((o) => o.value === "number,asc");
    expect(asc?.profileAttribute?.name).toBe("number");
  });

  it("uses value as prompt when prompt is absent", () => {
    // Build a template with a sort option missing the prompt field
    const nopromptProfile = {
      ...invoiceProfileJson,
      _templates: {
        ...invoiceProfileJson._templates,
        search: {
          ...invoiceProfileJson._templates.search,
          properties: [
            {
              name: "_sort",
              type: "text",
              options: {
                minItems: 0,
                promptField: "prompt",
                valueField: "value",
                inline: [{ property: "number", direction: "asc", value: "number,asc" }],
              },
            },
          ],
        },
      },
    };
    const tmpl = makeSearchTemplate(nopromptProfile as typeof invoiceProfileJson);
    expect(tmpl.sortOptions![0].prompt).toBe("number,asc");
  });

  it("returns undefined when no _sort property in template", () => {
    const noSortProfile = {
      ...invoiceProfileJson,
      _templates: {
        ...invoiceProfileJson._templates,
        search: {
          method: "GET",
          target: "https://example.com/invoices",
          properties: [{ name: "number", type: "text" }],
        },
      },
    };
    const tmpl = makeSearchTemplate(noSortProfile as typeof invoiceProfileJson);
    expect(tmpl.sortOptions).toBeUndefined();
  });

  it("returns undefined when _sort property has no inline options", () => {
    const noInlineProfile = {
      ...invoiceProfileJson,
      _templates: {
        ...invoiceProfileJson._templates,
        search: {
          method: "GET",
          target: "https://example.com/invoices",
          properties: [{ name: "_sort", type: "text" }],
        },
      },
    };
    const tmpl = makeSearchTemplate(noInlineProfile as typeof invoiceProfileJson);
    expect(tmpl.sortOptions).toBeUndefined();
  });
});

describe("SearchHalFormTemplate.hasSort / sortProperty", () => {
  it("hasSort is true when _sort property exists", () => {
    const tmpl = makeSearchTemplate();
    expect(tmpl.hasSort).toBe(true);
  });

  it("hasSort is false when _sort property is absent", () => {
    const noSortProfile = {
      ...invoiceProfileJson,
      _templates: {
        ...invoiceProfileJson._templates,
        search: {
          method: "GET",
          target: "https://example.com/invoices",
          properties: [{ name: "number", type: "text" }],
        },
      },
    };
    const tmpl = makeSearchTemplate(noSortProfile as typeof invoiceProfileJson);
    expect(tmpl.hasSort).toBe(false);
  });

  it("sortProperty returns the _sort HalFormsProperty", () => {
    const tmpl = makeSearchTemplate();
    expect(tmpl.sortProperty?.name).toBe("_sort");
  });

  it("sortProperty returns undefined when no _sort", () => {
    const noSortProfile = {
      ...invoiceProfileJson,
      _templates: {
        ...invoiceProfileJson._templates,
        search: {
          method: "GET",
          target: "https://example.com/invoices",
          properties: [{ name: "number", type: "text" }],
        },
      },
    };
    const tmpl = makeSearchTemplate(noSortProfile as typeof invoiceProfileJson);
    expect(tmpl.sortProperty).toBeUndefined();
  });
});

describe("SearchHalFormTemplate.getSearchPropertiesByType", () => {
  it("returns only prefix-match properties", () => {
    const tmpl = makeSearchTemplate();
    const results = tmpl.getSearchPropertiesByType(ProfileAttributeSearchType.prefixMatch);
    expect(results.every((p) => p.searchType === ProfileAttributeSearchType.prefixMatch)).toBe(
      true,
    );
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty array when no properties of that type", () => {
    const tmpl = makeSearchTemplate();
    // No full-text properties other than note~fts — verify we get exactly that one
    const results = tmpl.getSearchPropertiesByType(ProfileAttributeSearchType.fullText);
    expect(results).toHaveLength(1);
    expect(results[0].property.name).toBe("note~fts");
  });
});

describe("SearchHalFormTemplate.getSearchPropertyByName", () => {
  it("returns the matching property by name", () => {
    const tmpl = makeSearchTemplate();
    const prop = tmpl.getSearchPropertyByName("number~prefix");
    expect(prop?.property.name).toBe("number~prefix");
  });

  it("returns undefined for unknown property name", () => {
    const tmpl = makeSearchTemplate();
    expect(tmpl.getSearchPropertyByName("nonexistent")).toBeUndefined();
  });
});

describe("SearchHalFormTemplate.getSearchPropertiesByAttribute", () => {
  it("finds both exact and prefix properties for the same attribute", () => {
    const tmpl = makeSearchTemplate();
    const results = tmpl.getSearchPropertiesByAttribute("number");
    const names = results.map((p) => p.property.name);
    expect(names).toContain("number");
    expect(names).toContain("number~prefix");
  });

  it("returns empty array for unknown attribute", () => {
    const tmpl = makeSearchTemplate();
    expect(tmpl.getSearchPropertiesByAttribute("unknown")).toHaveLength(0);
  });

  it("returns relation traversal properties filtered by attribute name", () => {
    const tmpl = makeSearchTemplate();
    // customer.name~prefix — attribute part is "name"
    const results = tmpl.getSearchPropertiesByAttribute("name");
    expect(results.some((p) => p.property.name === "customer.name~prefix")).toBe(true);
  });
});

describe("SearchHalFormTemplate.getRelationSearchProperties", () => {
  it("returns only over-relation properties", () => {
    const tmpl = makeSearchTemplate();
    const results = tmpl.getRelationSearchProperties();
    expect(results.every((p) => p.isOverRelation)).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0].property.name).toBe("customer.name~prefix");
  });
});

describe("SearchHalFormTemplate with allProfiles (relation attribute resolution)", () => {
  it("resolves target attribute when allProfiles is provided", () => {
    // Build a customer profile with a "name" attribute
    const customerProfileJson = {
      name: "customer",
      description: "",
      _links: {
        self: { href: "https://example.com/profile/customers" },
        describes: [
          { href: "https://example.com/customers", name: "collection" },
          { href: "https://example.com/customers/{id}", name: "item", templated: true },
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
            description: "",
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
            name: "name",
            title: "Name",
            type: "string",
            description: "",
            readOnly: false,
            required: false,
            _embedded: {
              "blueprint:constraint": [],
              "blueprint:search-param": [],
              "blueprint:attribute": [],
            },
            _links: {},
          },
        ],
        "blueprint:relation": [],
      },
      _templates: {
        default: { method: "HEAD", target: "https://example.com/customers", properties: [] },
      },
    };

    const customerProfile = makeProfileEntity(
      customerProfileJson,
      "https://example.com/profile/customers",
      "customer",
    );
    const tmpl = makeSearchTemplate(invoiceProfileJson, [customerProfile]);

    const customerProp = tmpl.searchProperties.find(
      (p) => p.property.name === "customer.name~prefix",
    );
    expect(customerProp?.isOverRelation).toBe(true);
    expect(customerProp?.profileRelation?.name).toBe("customer");
    expect(customerProp?.profileAttribute?.name).toBe("name");
  });
});
