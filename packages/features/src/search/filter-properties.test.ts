import { describe, expect, it } from "vitest";
import { SearchHalFormTemplate, createValues, resolveTemplate } from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import {
  applyFilterValues,
  buildFilterProperties,
  coerceFilterValue,
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
        name: "code",
        title: "Code",
        type: "string",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "code", title: "Code", type: "exact-match" },
            { name: "code~prefix", title: "Code prefix", type: "prefix-match" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "status",
        title: "Status",
        type: "string",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [{ name: "status", title: "Status", type: "exact-match" }],
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
            { name: "amount", title: "Amount", type: "exact-match" },
            { name: "amount~gt", title: "Amount gt", type: "greater-than" },
            { name: "amount~gte", title: "Amount gte", type: "greater-than-or-equal" },
            { name: "amount~lt", title: "Amount lt", type: "less-than" },
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
            { name: "due_date~before", title: "Due date before", type: "less-than" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "created_at",
        title: "Created At",
        type: "date",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "created_at", title: "Created at", type: "exact-match" },
            { name: "created_at~after", title: "Created at after", type: "greater-than" },
            { name: "created_at~before", title: "Created at before", type: "less-than" },
            { name: "created_at~from", title: "Created at from", type: "greater-than-or-equal" },
            { name: "created_at~until", title: "Created at until", type: "less-than-or-equal" },
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
        name: "rating",
        title: "Rating",
        type: "double",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [{ name: "rating", title: "Rating", type: "exact-match" }],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        // Simulates an `allowed-values` constraint on a NUMBER-typed attribute: the search
        // template exposes inline options (like an enum), but the underlying wire type is
        // still "number" — inputKind collapses to "select" for rendering, but coerceFilterValue
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
        { name: "code", type: "text" },
        { name: "code~prefix", type: "text" },
        {
          name: "status",
          type: "text",
          options: {
            minItems: 0,
            inline: ["draft", "published", "archived"],
          },
        },
        { name: "amount", type: "number" },
        { name: "amount~gt", type: "number" },
        { name: "amount~gte", type: "number" },
        { name: "amount~lt", type: "number" },
        { name: "amount~lte", type: "number" },
        { name: "due_date~after", type: "datetime" },
        { name: "due_date~before", type: "datetime" },
        { name: "created_at", type: "date" },
        { name: "created_at~after", type: "date" },
        { name: "created_at~before", type: "date" },
        { name: "created_at~from", type: "date" },
        { name: "created_at~until", type: "date" },
        { name: "note~fts", type: "text" },
        { name: "active", type: "checkbox" },
        { name: "rating", type: "number" },
        {
          name: "priority",
          type: "number",
          options: { minItems: 0, maxItems: 1, inline: ["1", "2", "3"] },
        },
        { name: "score", type: "range" },
        { name: "expires_at", type: "datetime-local" },
        { name: "products.product_name", type: "text" },
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
const sharedProps = buildFilterProperties(sharedTmpl);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildFilterProperties — text fields", () => {
  it("produces prefix-match property with correct operator", () => {
    const prefix = sharedProps.find((p) => p.name === "code~prefix")!;

    expect(prefix.searchOperator).toBe("prefix-match");
    expect(prefix.groupKey).toBe("code");
    expect(prefix.inputKind).toBe("text");
  });

  it("produces full-text property", () => {
    const fts = sharedProps.find((p) => p.name === "note~fts")!;

    expect(fts.searchOperator).toBe("full-text");
    expect(fts.groupKey).toBe("note");
  });

  it("produces exact-match text property with correct fields", () => {
    const title = sharedProps.find((p) => p.name === "title")!;

    expect(title.label).toBe("Title");
    expect(title.inputKind).toBe("text");
    expect(title.searchOperator).toBe("exact-match");
    expect(title.groupKey).toBe("title");
    expect(title.directionLabel).toBeUndefined();
    expect(title.dateEncoding).toBeUndefined();
  });
});

describe("buildFilterProperties — select fields", () => {
  it("produces select inputKind for inline-options property", () => {
    const status = sharedProps.find((p) => p.name === "status")!;

    expect(status.inputKind).toBe("select");
    expect(status.searchOperator).toBe("exact-match");
    expect(status.options).toEqual(["draft", "published", "archived"]);
  });

  it("carries the real wire type through separately from inputKind for a number-typed enum", () => {
    // "priority" has inline options (allowed-values), so inputKind is "select" — but the
    // server-declared wire type is "number". propertyType must stay "number" so
    // coerceFilterValue coerces correctly instead of returning a raw string (see the
    // "coerceFilterValue — wire type vs inputKind" describe block below).
    const priority = sharedProps.find((p) => p.name === "priority")!;

    expect(priority.inputKind).toBe("select");
    expect(priority.propertyType).toBe("number");
  });
});

describe("buildFilterProperties — date fields with iso encoding", () => {
  it("produces datetime inputKind for datetime attribute", () => {
    const after = sharedProps.find((p) => p.name === "due_date~after")!;

    expect(after.inputKind).toBe("datetime");
    expect(after.searchOperator).toBe("greater-than");
    expect(after.directionLabel).toBe("After");
    expect(after.dateEncoding).toBe("iso");
    expect(after.groupKey).toBe("due_date");
  });

  it("maps less-than to Before direction", () => {
    const before = sharedProps.find((p) => p.name === "due_date~before")!;

    expect(before.searchOperator).toBe("less-than");
    expect(before.directionLabel).toBe("Before");
    expect(before.dateEncoding).toBe("iso");
  });
});

describe("buildFilterProperties — range-pair operators (~from / ~until)", () => {
  it("maps ~from to greater-than-or-equal with From direction and plain encoding", () => {
    const from = sharedProps.find((p) => p.name === "created_at~from")!;

    expect(from.searchOperator).toBe("greater-than-or-equal");
    expect(from.directionLabel).toBe("From");
    expect(from.dateEncoding).toBe("plain");
    expect(from.groupKey).toBe("created_at");
    expect(from.inputKind).toBe("date");
  });

  it("maps ~until to less-than-or-equal with Until direction and plain encoding", () => {
    const until = sharedProps.find((p) => p.name === "created_at~until")!;

    expect(until.searchOperator).toBe("less-than-or-equal");
    expect(until.directionLabel).toBe("Until");
    expect(until.dateEncoding).toBe("plain");
    expect(until.groupKey).toBe("created_at");
  });

  it("maps long ~gte to number inputKind with From direction and no dateEncoding", () => {
    const gte = sharedProps.find((p) => p.name === "amount~gte")!;

    expect(gte.inputKind).toBe("number");
    expect(gte.searchOperator).toBe("greater-than-or-equal");
    expect(gte.directionLabel).toBe("From");
    expect(gte.dateEncoding).toBeUndefined();
    expect(gte.groupKey).toBe("amount");
  });

  it("maps long ~lte to number inputKind with Until direction", () => {
    const lte = sharedProps.find((p) => p.name === "amount~lte")!;

    expect(lte.inputKind).toBe("number");
    expect(lte.searchOperator).toBe("less-than-or-equal");
    expect(lte.directionLabel).toBe("Until");
  });
});

describe("buildFilterProperties — wire-type mapping (boolean, number, datetime aliases)", () => {
  it("maps the 'checkbox' wire type to boolean inputKind", () => {
    expect(sharedProps.find((p) => p.name === "active")!.inputKind).toBe("boolean");
  });

  it("maps the 'number' wire type to number inputKind", () => {
    expect(sharedProps.find((p) => p.name === "rating")!.inputKind).toBe("number");
  });

  it("maps the 'range' wire type to number inputKind", () => {
    expect(sharedProps.find((p) => p.name === "score")!.inputKind).toBe("number");
  });

  it("maps the 'datetime-local' wire type to datetime inputKind", () => {
    expect(sharedProps.find((p) => p.name === "expires_at")!.inputKind).toBe("datetime");
  });
});

describe("buildFilterProperties — label resolution", () => {
  it("uses profile attribute title as label", () => {
    expect(sharedProps.find((p) => p.name === "title")!.label).toBe("Title");
  });

  it("uses property prompt when provided, over attribute title", () => {
    const customJson = {
      ...profileJson,
      _templates: {
        ...profileJson._templates,
        search: {
          ...profileJson._templates.search,
          properties: [{ name: "title", type: "text", prompt: "Document Name" }],
        },
      },
    };
    const tmpl = makeSearchTemplate(customJson);
    const props = buildFilterProperties(tmpl);
    expect(props.find((p) => p.name === "title")!.label).toBe("Document Name");
  });

  it("falls back to formatFieldName when no attribute title or prompt is available", () => {
    const noTitleJson = {
      ...profileJson,
      _embedded: { ...profileJson._embedded, "blueprint:attribute": [], "blueprint:relation": [] },
      _templates: {
        ...profileJson._templates,
        search: {
          method: "GET",
          target: "https://example.com/items",
          properties: [{ name: "some_field", type: "text" }],
        },
      },
    };
    const props = buildFilterProperties(makeSearchTemplate(noTitleJson));
    expect(props.find((p) => p.name === "some_field")!.label).toBe("Some Field");
  });
});

describe("buildFilterProperties — groupLabel", () => {
  it("is shared by every property in the same group, independent of array order", () => {
    const group = sharedProps.filter((p) => p.groupKey === "created_at");
    expect(group.length).toBeGreaterThan(1);
    expect(new Set(group.map((p) => p.groupLabel))).toEqual(new Set(["Created At"]));
  });

  it("survives redundant-sibling removal — the exact-match property carrying the attribute's own title can be suppressed, but the group label is computed independently", () => {
    // "created_at" (bare exact-match) is suppressed below since ~after/~before/~from/~until
    // siblings exist — but the surviving siblings still report "Created At" as their groupLabel.
    expect(sharedProps.find((p) => p.name === "created_at")).toBeUndefined();
    const survivor = sharedProps.find((p) => p.name === "created_at~from")!;
    expect(survivor.groupLabel).toBe("Created At");
  });

  it("falls back to a formatted groupKey for a relation-traversal group (no profileAttribute to resolve)", () => {
    const relationProp = sharedProps.find((p) => p.name === "products.product_name~prefix")!;
    expect(relationProp.groupLabel).toBe("Products Product Name");
  });
});

describe("buildFilterProperties — redundant exact-match suppression", () => {
  it("suppresses a bare exact-match property when a prefix-match sibling exists", () => {
    expect(sharedProps.find((p) => p.name === "code")).toBeUndefined();
    expect(sharedProps.find((p) => p.name === "code~prefix")).toBeDefined();
  });

  it("suppresses a bare exact-match date property when after/before/from/until siblings exist", () => {
    // created_at exposes exact-match, ~after/~before (strict), AND ~from/~until (inclusive):
    // the exact-match is dropped as redundant, and so is the strict pair once its inclusive
    // equivalent exists — only ~from/~until (inclusive) survive.
    expect(sharedProps.find((p) => p.name === "created_at")).toBeUndefined();
    expect(sharedProps.find((p) => p.name === "created_at~after")).toBeUndefined();
    expect(sharedProps.find((p) => p.name === "created_at~from")).toBeDefined();
    expect(sharedProps.find((p) => p.name === "created_at~until")).toBeDefined();
  });

  it("suppresses a bare exact-match relation-traversal property when a prefix-match sibling exists", () => {
    expect(sharedProps.find((p) => p.name === "products.product_name")).toBeUndefined();
    expect(sharedProps.find((p) => p.name === "products.product_name~prefix")).toBeDefined();
  });

  it("keeps a bare exact-match property that has no more-specific sibling", () => {
    expect(sharedProps.find((p) => p.name === "status")).toBeDefined();
    expect(sharedProps.find((p) => p.name === "active")).toBeDefined();
  });

  it("keeps a bare exact-match NUMBER property even when range siblings exist", () => {
    // Mirrors the legacy Navigator (RangedJsfFormConvertor.createJsonProperty in
    // contentgrid-navigator's src/components/form/jsonforms.ts), which only drops the lone
    // base property for a datetime/datetime-local attribute — a numeric attribute like
    // "amount" keeps its bare exact-match filter alongside its range siblings.
    expect(sharedProps.find((p) => p.name === "amount")).toBeDefined();
  });
});

describe("buildFilterProperties — redundant strict range bound suppression", () => {
  it("suppresses the strict greater-than bound once the inclusive greater-than-or-equal bound exists", () => {
    // "amount" has both ~gt and ~gte — only ~gte (inclusive) should survive.
    expect(sharedProps.find((p) => p.name === "amount~gt")).toBeUndefined();
    expect(sharedProps.find((p) => p.name === "amount~gte")).toBeDefined();
  });

  it("suppresses the strict less-than bound once the inclusive less-than-or-equal bound exists", () => {
    expect(sharedProps.find((p) => p.name === "amount~lt")).toBeUndefined();
    expect(sharedProps.find((p) => p.name === "amount~lte")).toBeDefined();
  });

  it("keeps the strict bound when no inclusive equivalent exists for that attribute", () => {
    // "due_date" only has ~after/~before (no ~from/~until) — nothing to suppress them with.
    expect(sharedProps.find((p) => p.name === "due_date~after")).toBeDefined();
    expect(sharedProps.find((p) => p.name === "due_date~before")).toBeDefined();
  });
});

describe("buildFilterProperties — _sort excluded", () => {
  it("does not include the _sort control property", () => {
    expect(sharedProps.find((p) => p.name === "_sort")).toBeUndefined();
  });
});

describe("buildFilterProperties — hidden properties excluded", () => {
  it("excludes a 'hidden' wire-type property from the result", () => {
    // Hidden properties carry a fixed/internal value (e.g. relation-scoping params
    // injected via withHiddenParams) and were never meant to be a user-facing filter.
    const hiddenJson = {
      ...profileJson,
      _templates: {
        ...profileJson._templates,
        search: {
          ...profileJson._templates.search,
          properties: [
            ...profileJson._templates.search.properties,
            { name: "_internal_scope", type: "hidden", value: "abc" },
          ],
        },
      },
    };
    const props = buildFilterProperties(makeSearchTemplate(hiddenJson));
    expect(props.find((p) => p.name === "_internal_scope")).toBeUndefined();
  });
});

describe("buildFilterProperties — _sort-only template", () => {
  it("returns empty array when the search template contains only the _sort control property", () => {
    const sortOnlyJson = {
      ...profileJson,
      _embedded: { ...profileJson._embedded, "blueprint:attribute": [], "blueprint:relation": [] },
      _templates: {
        default: { method: "HEAD", target: "https://example.com/items", properties: [] },
        search: {
          method: "GET",
          target: "https://example.com/items",
          properties: [{ name: "_sort", type: "text", options: { minItems: 0, inline: [] } }],
        },
      },
    };
    expect(buildFilterProperties(makeSearchTemplate(sortOnlyJson))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// coerceFilterValue / applyFilterValues — the HAL-FORMS codec requires a real
// number/boolean/Date for these kinds and throws on a raw string (see
// packages/features/src/entity-list/index.tsx for where this is applied).
//
// Switches on the wire type (HalFormsPropertyType), not FilterInputKind — inputKind collapses
// to "select" whenever inline options are present, which would otherwise lose the real type.
// ---------------------------------------------------------------------------

describe("coerceFilterValue — wire type vs inputKind", () => {
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

  it("coerces by the real wire type for a number-typed property with inline options (inputKind='select')", () => {
    // Regression: switching on inputKind here would hit "select" and return a raw string,
    // which the codec rejects for a "number"-typed property — see the "priority" fixture above.
    const priority = sharedProps.find((p) => p.name === "priority")!;
    expect(priority.inputKind).toBe("select");
    expect(coerceFilterValue(priority.propertyType, "2")).toBe(2);
  });
});

describe("applyFilterValues", () => {
  it("coerces each filter by its wire type and omits values that fail to coerce", () => {
    const result = applyFilterValues(createValues(sharedTmpl.template), sharedProps, {
      title: "hello",
      "amount~gte": "100",
      "due_date~after": "2024-01-15T10:30:00Z",
    });

    expect(result.value("title").value).toBe("hello");
    expect(result.value("amount~gte").value).toBe(100);
    expect(result.value("due_date~after").value).toBeInstanceOf(Date);
  });

  it("omits a filter value that fails to coerce for its wire type", () => {
    const result = applyFilterValues(createValues(sharedTmpl.template), sharedProps, {
      "amount~gte": "not-a-number",
    });
    expect(result.value("amount~gte").value).toBeUndefined();
  });

  it("skips empty-string filter values entirely", () => {
    const result = applyFilterValues(createValues(sharedTmpl.template), sharedProps, {
      title: "",
    });
    expect(result.value("title").value).toBeUndefined();
  });
});

describe("findInvalidFilterKeys", () => {
  it("flags a key whose raw value fails to coerce for its wire type", () => {
    const invalid = findInvalidFilterKeys(sharedProps, { "amount~gte": "not-a-number" });
    expect(invalid).toEqual(["amount~gte"]);
  });

  it("does not flag a key whose value coerces successfully", () => {
    const invalid = findInvalidFilterKeys(sharedProps, { "amount~gte": "100" });
    expect(invalid).toEqual([]);
  });

  it("does not flag an empty-string value — that's 'no filter', not an invalid one", () => {
    const invalid = findInvalidFilterKeys(sharedProps, { "amount~gte": "" });
    expect(invalid).toEqual([]);
  });

  it("flags every failing key, not just the first", () => {
    const invalid = findInvalidFilterKeys(sharedProps, {
      "amount~gte": "not-a-number",
      "due_date~after": "not-a-date",
    });
    expect(invalid).toContain("amount~gte");
    expect(invalid).toContain("due_date~after");
    expect(invalid).toHaveLength(2);
  });

  it("matches exactly the keys applyFilterValues silently omits", () => {
    const filters = { title: "hello", "amount~gte": "not-a-number" };
    const values = applyFilterValues(createValues(sharedTmpl.template), sharedProps, filters);
    const invalid = findInvalidFilterKeys(sharedProps, filters);

    expect(values.value("amount~gte").value).toBeUndefined();
    expect(invalid).toEqual(["amount~gte"]);
  });
});
