import { describe, expect, it } from "vitest";
import { SearchHalFormTemplate, createValues, resolveTemplate } from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { resolveHalFormsFields } from "../hal-forms";
import {
  applyFilterValues,
  coerceFilterValue,
  extractFilterValuesFromCollectionUrl,
  findActivelyFilteredAttributeNames,
  findInvalidFilterKeys,
} from "./filter-properties";

function makeSearchTemplate(json: Record<string, unknown>): SearchHalFormTemplate {
  const profile = makeProfileEntity(json, "https://example.com/profile/items", "item");
  const rawTemplate = resolveTemplate(
    json as unknown as Parameters<typeof resolveTemplate>[0],
    "search",
  )!;
  return new SearchHalFormTemplate(rawTemplate, profile);
}

// ---------------------------------------------------------------------------
// Base profile fixture
//
// Operator suffixes use a single plain tilde, never a dotted "attribute.~op" form — verified
// against the committed profile dump for ~prefix/~gt/~gte/~lt/~lte/~after/~before. The
// inclusive range-pair bounds ("~from"/"~until") aren't in that dump, but are real and
// plain-tilde per the legacy Navigator's NestedRange pairing
// (contentgrid-navigator/src/components/form/jsonforms.ts:325).
//
// Redundant-sibling suppression and hidden-property exclusion are `resolveHalFormsFields`'s
// responsibility now (see `../hal-forms/model/resolve-hal-forms-fields.test.ts`) — this fixture
// only needs to exercise the encode/decode helpers below, so it keeps one representative
// property per wire type rather than every redundancy edge case.
// ---------------------------------------------------------------------------

const profileJson = {
  name: "item",
  description: "",
  _links: {
    self: { href: "https://example.com/profile/items" },
    describes: [
      { href: "https://example.com/items", name: "collection" },
      { href: "https://example.com/items/{id}", name: "item", templated: true },
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
        name: "title",
        title: "Title",
        type: "string",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [{ name: "title", title: "Title", type: "exact-match" }],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "amount",
        title: "Amount",
        type: "long",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "amount~gte", title: "Amount gte", type: "greater-than-or-equal" },
            { name: "amount~lte", title: "Amount lte", type: "less-than-or-equal" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "due_date",
        title: "Due Date",
        type: "datetime",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "due_date~after", title: "Due date after", type: "greater-than" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "active",
        title: "Active",
        type: "boolean",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [{ name: "active", title: "Active", type: "exact-match" }],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        // Simulates an `allowed-values` constraint on a NUMBER-typed attribute: the search
        // template exposes inline options (like an enum), but the underlying wire type is
        // still "number" — `kind` collapses to "enum" for rendering, but coerceFilterValue
        // must still coerce by the real wire type or the codec throws HalFormValueTypeError.
        name: "priority",
        title: "Priority",
        type: "long",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [{ type: "allowed-values", values: ["1", "2", "3"] }],
          "blueprint:search-param": [{ name: "priority", title: "Priority", type: "exact-match" }],
          "blueprint:attribute": [],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [
      {
        name: "products",
        title: "Products",
        description: "Products included in the invoice.",
        many_source_per_target: true,
        many_target_per_source: true,
        required: false,
        _links: { "blueprint:target-entity": { href: "https://example.com/profile/products" } },
      },
    ],
  },
  _templates: {
    default: { method: "HEAD", target: "https://example.com/items", properties: [] },
    search: {
      method: "GET",
      target: "https://example.com/items",
      properties: [
        { name: "title", type: "text" },
        { name: "amount~gte", type: "number" },
        { name: "amount~lte", type: "number" },
        { name: "due_date~after", type: "datetime" },
        { name: "active", type: "checkbox" },
        {
          name: "priority",
          type: "number",
          options: { minItems: 0, maxItems: 1, inline: ["1", "2", "3"] },
        },
        { name: "products.product_name~prefix", type: "text" },
        {
          name: "_sort",
          type: "text",
          options: {
            minItems: 0,
            inline: [{ property: "title", direction: "asc", value: "title,asc" }],
          },
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Shared results — computed once from the static fixture
// ---------------------------------------------------------------------------

const sharedTmpl = makeSearchTemplate(profileJson);
const sharedFields = resolveHalFormsFields(sharedTmpl).fields;

// ---------------------------------------------------------------------------
// coerceFilterValue / applyFilterValues — the HAL-FORMS codec requires a real
// number/boolean/Date for these kinds and throws on a raw string (see
// packages/features/src/entity-list/index.tsx for where this is applied).
//
// Switches on the wire type (HalFormsPropertyType), not `HalFormsField.kind` — `kind` collapses
// to "enum" whenever inline options are present, which would otherwise lose the real type.
// ---------------------------------------------------------------------------

describe("coerceFilterValue — wire type vs kind", () => {
  it("'number'/'range' wire type: coerces a numeric string, returns undefined for a non-numeric one", () => {
    expect(coerceFilterValue("number", "42")).toBe(42);
    expect(coerceFilterValue("range", "42")).toBe(42);
    expect(coerceFilterValue("number", "abc")).toBeUndefined();
  });

  it("'checkbox' wire type: coerces 'true'/'false', returns undefined for anything else", () => {
    expect(coerceFilterValue("checkbox", "true")).toBe(true);
    expect(coerceFilterValue("checkbox", "false")).toBe(false);
    expect(coerceFilterValue("checkbox", "yes")).toBeUndefined();
  });

  it("'datetime'/'datetime-local' wire type: coerces a valid ISO string to a Date, returns undefined if unparseable", () => {
    expect(coerceFilterValue("datetime", "2024-01-15T10:30:00Z")).toBeInstanceOf(Date);
    expect(coerceFilterValue("datetime-local", "2024-01-15T10:30:00Z")).toBeInstanceOf(Date);
    expect(coerceFilterValue("datetime", "not-a-date")).toBeUndefined();
  });

  it("'text' wire type (and any other kind): passes the value through unchanged", () => {
    expect(coerceFilterValue("text", "hello")).toBe("hello");
  });

  it("coerces by the real wire type for a number-typed property with inline options (kind='enum')", () => {
    // Regression: switching on `kind` here would hit "enum" and return a raw string, which the
    // codec rejects for a "number"-typed property — see the "priority" fixture above.
    const priority = sharedFields.find((f) => f.name === "priority")!;
    expect(priority.kind).toBe("enum");
    expect(coerceFilterValue(priority.property.type, "2")).toBe(2);
  });
});

describe("applyFilterValues", () => {
  it("coerces each filter by its wire type and omits values that fail to coerce", () => {
    const result = applyFilterValues(createValues(sharedTmpl.template), sharedFields, {
      title: "hello",
      "amount~gte": "100",
      "due_date~after": "2024-01-15T10:30:00Z",
    });

    expect(result.value("title").value).toBe("hello");
    expect(result.value("amount~gte").value).toBe(100);
    expect(result.value("due_date~after").value).toBeInstanceOf(Date);
  });

  it("omits a filter value that fails to coerce for its wire type", () => {
    const result = applyFilterValues(createValues(sharedTmpl.template), sharedFields, {
      "amount~gte": "not-a-number",
    });
    expect(result.value("amount~gte").value).toBeUndefined();
  });

  it("skips empty-string filter values entirely", () => {
    const result = applyFilterValues(createValues(sharedTmpl.template), sharedFields, {
      title: "",
    });
    expect(result.value("title").value).toBeUndefined();
  });
});

describe("extractFilterValuesFromCollectionUrl", () => {
  it("extracts values for known filter fields from the query string", () => {
    const result = extractFilterValuesFromCollectionUrl(
      sharedFields,
      "https://api.example.com/items?title=hello&amount~gte=100",
    );
    expect(result).toEqual({ title: "hello", "amount~gte": "100" });
  });

  it("ignores _cursor, _sort, _size, and _internal_* params", () => {
    const result = extractFilterValuesFromCollectionUrl(
      sharedFields,
      "https://api.example.com/items?title=hello&_cursor=abc&_sort=title,asc&_size=20&_internal_invoice__products=xyz",
    );
    expect(result).toEqual({ title: "hello" });
  });

  it("ignores query params that don't match any known filter field", () => {
    const result = extractFilterValuesFromCollectionUrl(
      sharedFields,
      "https://api.example.com/items?unknown_param=hello",
    );
    expect(result).toEqual({});
  });

  it("returns an empty object for a URL with no query string", () => {
    expect(
      extractFilterValuesFromCollectionUrl(sharedFields, "https://api.example.com/items"),
    ).toEqual({});
  });

  it("resolves a relative URL against a placeholder base rather than throwing", () => {
    const result = extractFilterValuesFromCollectionUrl(sharedFields, "/items?title=hello");
    expect(result).toEqual({ title: "hello" });
  });

  it("returns an empty object for an unparseable URL", () => {
    expect(extractFilterValuesFromCollectionUrl(sharedFields, "http://[::1")).toEqual({});
  });

  it("round-trips with applyFilterValues via searchEntityRequest-shaped URLs", () => {
    const values = applyFilterValues(createValues(sharedTmpl.template), sharedFields, {
      title: "hello",
      "amount~gte": "100",
    });
    const encodedParams = Object.entries(values.valueMap).filter(([, v]) => v !== undefined);
    const url = `https://api.example.com/items?${new URLSearchParams(
      encodedParams.map(([k, v]) => [k, String(v)]),
    ).toString()}`;

    expect(extractFilterValuesFromCollectionUrl(sharedFields, url)).toEqual({
      title: "hello",
      "amount~gte": "100",
    });
  });
});

describe("findInvalidFilterKeys", () => {
  it("flags a key whose raw value fails to coerce for its wire type", () => {
    const invalid = findInvalidFilterKeys(sharedFields, { "amount~gte": "not-a-number" });
    expect(invalid).toEqual(["amount~gte"]);
  });

  it("does not flag a key whose value coerces successfully", () => {
    const invalid = findInvalidFilterKeys(sharedFields, { "amount~gte": "100" });
    expect(invalid).toEqual([]);
  });

  it("does not flag an empty-string value — that's 'no filter', not an invalid one", () => {
    const invalid = findInvalidFilterKeys(sharedFields, { "amount~gte": "" });
    expect(invalid).toEqual([]);
  });

  it("flags every failing key, not just the first", () => {
    const invalid = findInvalidFilterKeys(sharedFields, {
      "amount~gte": "not-a-number",
      "due_date~after": "not-a-date",
    });
    expect(invalid).toContain("amount~gte");
    expect(invalid).toContain("due_date~after");
    expect(invalid).toHaveLength(2);
  });

  it("matches exactly the keys applyFilterValues silently omits", () => {
    const filters = { title: "hello", "amount~gte": "not-a-number" };
    const values = applyFilterValues(createValues(sharedTmpl.template), sharedFields, filters);
    const invalid = findInvalidFilterKeys(sharedFields, filters);

    expect(values.value("amount~gte").value).toBeUndefined();
    expect(invalid).toEqual(["amount~gte"]);
  });
});

describe("findActivelyFilteredAttributeNames", () => {
  it("returns the groupKey for a directly-filtered, non-relation property", () => {
    const names = findActivelyFilteredAttributeNames(sharedTmpl, { title: "hello" });
    expect(names).toEqual(["title"]);
  });

  it("excludes a relation-traversal property even when its filter value is present", () => {
    const relationProp = sharedTmpl.getSearchPropertyByName("products.product_name~prefix")!;
    expect(relationProp.isOverRelation).toBe(true);

    const names = findActivelyFilteredAttributeNames(sharedTmpl, {
      [relationProp.property.name]: "widget",
    });

    expect(names).toEqual([]);
  });

  it("de-dupes two sibling properties sharing one groupKey into a single entry", () => {
    const names = findActivelyFilteredAttributeNames(sharedTmpl, {
      "amount~gte": "10",
      "amount~lte": "100",
    });

    expect(names).toEqual(["amount"]);
  });

  it("returns an empty array when no filters have a non-empty value", () => {
    const names = findActivelyFilteredAttributeNames(sharedTmpl, { title: "", "amount~gte": "" });
    expect(names).toEqual([]);
  });

  it("ignores a filter key with no matching search property", () => {
    const names = findActivelyFilteredAttributeNames(sharedTmpl, { unknown_key: "x" });
    expect(names).toEqual([]);
  });
});
