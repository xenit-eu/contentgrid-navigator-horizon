import { describe, expect, it } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import { resolveTemplate } from "@contentgrid/hal-forms";
import { createValues } from "@contentgrid/hal-forms/values";
import type { ProfileEntityShape } from "../../shapes";
import ProfileEntity from "../entity-profile";
import { applyFilterValues, buildFilterProperties, coerceFilterValue } from "./filter-properties";
import { SearchHalFormTemplate } from "./search-form";

// ---------------------------------------------------------------------------
// Helpers (mirror pattern from search-form.test.ts)
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

function makeSearchTemplate(json: Record<string, unknown>): SearchHalFormTemplate {
  const profile = makeProfileEntity(json, "https://example.com/profile/items", "item");
  const rawTemplate = resolveTemplate(json as unknown as ProfileEntityShape, "search")!;
  return new SearchHalFormTemplate(rawTemplate, profile, []);
}

// ---------------------------------------------------------------------------
// Base profile fixture
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
            { name: "amount.~gte", title: "Amount gte", type: "greater-than-or-equal" },
            { name: "amount.~lte", title: "Amount lte", type: "less-than-or-equal" },
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
            { name: "created_at.~from", title: "Created at from", type: "greater-than-or-equal" },
            { name: "created_at.~until", title: "Created at until", type: "less-than-or-equal" },
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
    ],
    "blueprint:relation": [],
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
        { name: "amount.~gte", type: "number" },
        { name: "amount.~lte", type: "number" },
        { name: "due_date~after", type: "datetime" },
        { name: "due_date~before", type: "datetime" },
        { name: "created_at.~from", type: "date" },
        { name: "created_at.~until", type: "date" },
        { name: "note~fts", type: "text" },
        { name: "active", type: "checkbox" },
        { name: "rating", type: "number" },
        { name: "score", type: "range" },
        { name: "expires_at", type: "datetime-local" },
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
  it("produces exact-match text property with correct fields", () => {
    const title = sharedProps.find((p) => p.name === "title")!;

    expect(title.label).toBe("Title");
    expect(title.inputKind).toBe("text");
    expect(title.searchOperator).toBe("exact-match");
    expect(title.groupKey).toBe("title");
    expect(title.directionLabel).toBeUndefined();
    expect(title.dateEncoding).toBeUndefined();
  });

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
});

describe("buildFilterProperties — select fields", () => {
  it("produces select inputKind for inline-options property", () => {
    const status = sharedProps.find((p) => p.name === "status")!;

    expect(status.inputKind).toBe("select");
    expect(status.searchOperator).toBe("exact-match");
    expect(status.options).toEqual(["draft", "published", "archived"]);
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

describe("buildFilterProperties — range-pair operators (.~from / .~until)", () => {
  it("maps .~from to greater-than-or-equal with From direction and plain encoding", () => {
    const from = sharedProps.find((p) => p.name === "created_at.~from")!;

    expect(from.searchOperator).toBe("greater-than-or-equal");
    expect(from.directionLabel).toBe("From");
    expect(from.dateEncoding).toBe("plain");
    expect(from.groupKey).toBe("created_at");
    expect(from.inputKind).toBe("date");
  });

  it("maps .~until to less-than-or-equal with Until direction and plain encoding", () => {
    const until = sharedProps.find((p) => p.name === "created_at.~until")!;

    expect(until.searchOperator).toBe("less-than-or-equal");
    expect(until.directionLabel).toBe("Until");
    expect(until.dateEncoding).toBe("plain");
    expect(until.groupKey).toBe("created_at");
  });

  it("maps long .~gte to number inputKind with From direction and no dateEncoding", () => {
    const gte = sharedProps.find((p) => p.name === "amount.~gte")!;

    expect(gte.inputKind).toBe("number");
    expect(gte.searchOperator).toBe("greater-than-or-equal");
    expect(gte.directionLabel).toBe("From");
    expect(gte.dateEncoding).toBeUndefined();
    expect(gte.groupKey).toBe("amount");
  });

  it("maps long .~lte to number inputKind with Until direction", () => {
    const lte = sharedProps.find((p) => p.name === "amount.~lte")!;

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
// ---------------------------------------------------------------------------

describe("coerceFilterValue", () => {
  it("'number' kind: coerces a numeric string, returns undefined for a non-numeric one", () => {
    expect(coerceFilterValue("number", "42")).toBe(42);
    expect(coerceFilterValue("number", "abc")).toBeUndefined();
  });

  it("'boolean' kind: coerces 'true'/'false', returns undefined for anything else", () => {
    expect(coerceFilterValue("boolean", "true")).toBe(true);
    expect(coerceFilterValue("boolean", "false")).toBe(false);
    expect(coerceFilterValue("boolean", "yes")).toBeUndefined();
  });

  it("'datetime' kind: coerces a valid ISO string to a Date, returns undefined if unparseable", () => {
    expect(coerceFilterValue("datetime", "2024-01-15T10:30:00Z")).toBeInstanceOf(Date);
    expect(coerceFilterValue("datetime", "not-a-date")).toBeUndefined();
  });

  it("'text' kind (and any other kind): passes the value through unchanged", () => {
    expect(coerceFilterValue("text", "hello")).toBe("hello");
  });
});

describe("applyFilterValues", () => {
  it("coerces each filter by its inputKind and omits values that fail to coerce", () => {
    const result = applyFilterValues(createValues(sharedTmpl.template), sharedProps, {
      title: "hello",
      "amount.~gte": "100",
      "amount.~lte": "not-a-number",
      "due_date~after": "2024-01-15T10:30:00Z",
    });

    expect(result.value("title").value).toBe("hello");
    expect(result.value("amount.~gte").value).toBe(100);
    expect(result.value("amount.~lte").value).toBeUndefined();
    expect(result.value("due_date~after").value).toBeInstanceOf(Date);
  });

  it("skips empty-string filter values entirely", () => {
    const result = applyFilterValues(createValues(sharedTmpl.template), sharedProps, {
      title: "",
    });
    expect(result.value("title").value).toBeUndefined();
  });
});
