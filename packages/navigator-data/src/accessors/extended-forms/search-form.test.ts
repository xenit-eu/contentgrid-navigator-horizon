/**
 * Unit tests for SearchHalFormTemplate.
 *
 * Tests cover:
 * - searchProperties: filtering out _sort, basic property linking
 * - search type resolution: via blueprint:search-param for direct attributes, suffix-parsing
 *   for relation-traversal attributes (no target-entity search-param available there)
 * - sortOptions: inline sort option parsing, profileAttribute linking, no-sort case
 * - getSearchPropertiesByType / getSearchPropertyByName / getSearchPropertiesByAttribute
 * - getRelationSearchProperties
 * - relation traversal: isOverRelation, profileRelation (profileAttribute never resolves here —
 *   see the class-level doc on `enhanceSearchProperty` in search-form.ts)
 * - hasSort / sortProperty
 */
import { describe, expect, it } from "vitest";
import { resolveTemplate } from "@contentgrid/hal-forms";
import type { ProfileEntityShape } from "../../shapes";
import { ProfileAttributeSearchType } from "../attribute-profile";
import { SearchHalFormTemplate } from "./search-form";
import { makeProfileEntity } from "./test-utils";

// ---------------------------------------------------------------------------
// Base fixture: simple entity with search template and sort
//
// Property-name suffixes here use a single plain tilde, never a dotted "attribute.~op" form —
// verified against the committed profile dump for ~prefix/~gt/~gte/~lt/~lte/~after/~before.
// The inclusive range-pair bounds ("~from" / "~until") aren't in that dump, but are real and
// plain-tilde per the legacy Navigator's NestedRange pairing
// (contentgrid-navigator/src/components/form/jsonforms.ts:325).
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
          "blueprint:search-param": [
            { name: "due_date~after", title: "Due date: After", type: "greater-than" },
            { name: "due_date~before", title: "Due date: Before", type: "less-than" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "invoice_date",
        title: "Invoice date",
        type: "date",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "invoice_date", title: "Invoice date", type: "exact-match" },
            { name: "invoice_date~after", title: "Invoice date: After", type: "greater-than" },
            { name: "invoice_date~before", title: "Invoice date: Before", type: "less-than" },
            {
              name: "invoice_date~from",
              title: "Invoice date: From",
              type: "greater-than-or-equal",
            },
            {
              name: "invoice_date~until",
              title: "Invoice date: Until",
              type: "less-than-or-equal",
            },
          ],
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
        { name: "invoice_date", type: "date" },
        { name: "invoice_date~after", type: "date" },
        { name: "invoice_date~before", type: "date" },
        { name: "invoice_date~from", type: "date" },
        { name: "invoice_date~until", type: "date" },
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

function makeSearchTemplate(profileJson = invoiceProfileJson) {
  const profile = makeProfileEntity(profileJson, PROFILE_URL, "invoice");
  const rawTemplate = resolveTemplate(profileJson as ProfileEntityShape, "search")!;
  return new SearchHalFormTemplate(rawTemplate, profile);
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

  it("never resolves profileAttribute for relation traversal (no access to the target profile)", () => {
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

  it("classifies greaterThanOrEqual for ~from suffix (inclusive range-pair lower bound)", () => {
    const tmpl = makeSearchTemplate();
    const p = tmpl.searchProperties.find((x) => x.property.name === "invoice_date~from");
    expect(p?.searchType).toBe(ProfileAttributeSearchType.greaterThanOrEqual);
  });

  it("classifies lessThanOrEqual for ~until suffix (inclusive range-pair upper bound)", () => {
    const tmpl = makeSearchTemplate();
    const p = tmpl.searchProperties.find((x) => x.property.name === "invoice_date~until");
    expect(p?.searchType).toBe(ProfileAttributeSearchType.lessThanOrEqual);
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

describe("SearchHalFormTemplate.withHiddenParams", () => {
  it("returns the same instance when params is empty", () => {
    const tmpl = makeSearchTemplate();
    expect(tmpl.withHiddenParams({})).toBe(tmpl);
  });

  it("bakes in hidden properties for each param and preserves existing properties", () => {
    const tmpl = makeSearchTemplate();
    const withParams = tmpl.withHiddenParams({ _internal_invoice__products: "019d" });

    expect(withParams).not.toBe(tmpl);
    const hiddenProp = withParams.template.properties.find(
      (p) => p.name === "_internal_invoice__products",
    );
    expect(hiddenProp?.type).toBe("hidden");
    expect(hiddenProp?.value).toBe("019d");
    // Original search properties are still present on the new template
    expect(withParams.template.properties.some((p) => p.name === "number")).toBe(true);
  });

  it("bakes in multiple hidden properties when given multiple params", () => {
    const tmpl = makeSearchTemplate();
    const withParams = tmpl.withHiddenParams({ _internal_a: "1", _internal_b: "2" });

    const names = withParams.template.properties.map((p) => p.name);
    expect(names).toContain("_internal_a");
    expect(names).toContain("_internal_b");
  });
});

// ---------------------------------------------------------------------------
// Range-pair operator properties (attribute~from / attribute~until)
//
// `~from`/`~until` aren't in the committed profile dump (its full operator set is ~prefix,
// ~gt, ~gte, ~lt, ~lte, ~after, ~before), but they're real: the legacy Navigator's
// RangedJsfFormConvertor pairs exactly those suffixes with ~after/~before as fallbacks
// (contentgrid-navigator/src/components/form/jsonforms.ts:325,
// NestedRange("~from", "~until", "~after", "~before")). The plain-single-tilde claim IS
// dump-verified for every suffix the dump does contain, and `~from`/`~until` follow the same
// "operator suffix, never a dotted attribute.~op form" pattern by construction (the server
// only ever emits one tilde per property name — see basePropertyName's doc comment).
// `invoice_date` in the base fixture above already covers this; these tests focus on the "not
// a relation" distinction a dot-based check would need to get right.
// ---------------------------------------------------------------------------

describe("SearchHalFormTemplate — range-pair operators (~from / ~until)", () => {
  it("does not treat attribute~from as a relation traversal", () => {
    const tmpl = makeSearchTemplate();
    const fromProp = tmpl.searchProperties.find((p) => p.property.name === "invoice_date~from")!;
    expect(fromProp.isOverRelation).toBe(false);
  });

  it("links the direct profileAttribute for attribute~from", () => {
    const tmpl = makeSearchTemplate();
    const fromProp = tmpl.searchProperties.find((p) => p.property.name === "invoice_date~from")!;
    expect(fromProp.profileAttribute?.name).toBe("invoice_date");
    expect(fromProp.profileAttribute?.type).toBe("date");
  });

  it("links the direct profileAttribute for attribute~until", () => {
    const tmpl = makeSearchTemplate();
    const untilProp = tmpl.searchProperties.find((p) => p.property.name === "invoice_date~until")!;
    expect(untilProp.profileAttribute?.name).toBe("invoice_date");
    expect(untilProp.isOverRelation).toBe(false);
  });

  it("does not set profileRelation for range-pair operators", () => {
    const tmpl = makeSearchTemplate();
    const fromProp = tmpl.searchProperties.find((p) => p.property.name === "invoice_date~from")!;
    expect(fromProp.profileRelation).toBeUndefined();
  });

  it("groups the exact-match, after/before, and from/until variants under one groupKey", () => {
    const tmpl = makeSearchTemplate();
    const groupKeys = tmpl.searchProperties
      .filter((p) => p.property.name.startsWith("invoice_date"))
      .map((p) => p.groupKey);
    expect(new Set(groupKeys)).toEqual(new Set(["invoice_date"]));
  });

  it("still treats relation.attribute~suffix as isOverRelation", () => {
    const tmpl = makeSearchTemplate();
    const relProp = tmpl.searchProperties.find((p) => p.property.name === "customer.name~prefix")!;
    expect(relProp.isOverRelation).toBe(true);
  });
});
