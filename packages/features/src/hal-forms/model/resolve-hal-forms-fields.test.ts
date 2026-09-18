import { describe, expect, it } from "vitest";
import {
  CreateHalFormTemplate,
  SearchHalFormTemplate,
  resolveTemplate,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { resolveHalFormsFields } from "./resolve-hal-forms-fields";

const PROFILE_URL = "https://example.com/profile/contacts";

const contactProfileJson = {
  name: "contact",
  description: "",
  _links: {
    self: { href: PROFILE_URL },
    describes: [
      { href: "https://example.com/contacts", name: "collection" },
      { href: "https://example.com/contacts/{id}", name: "item", templated: true },
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
        name: "name",
        title: "Name",
        type: "string",
        description: "",
        readOnly: false,
        required: true,
        _embedded: {
          "blueprint:constraint": [{ type: "required" }],
          "blueprint:search-param": [],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "email",
        title: "Email",
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
      {
        name: "phone",
        title: "Phone",
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
    default: { method: "HEAD", target: "https://example.com/contacts", properties: [] },
    search: { method: "GET", target: "https://example.com/contacts", properties: [] },
    "create-form": {
      method: "POST",
      target: "https://example.com/contacts",
      contentType: "application/json",
      properties: [
        { name: "name", type: "text", required: true },
        { name: "email", type: "email" },
        { name: "phone", type: "text" },
      ],
    },
  },
};

function makeTemplate() {
  const profile = makeProfileEntity(contactProfileJson, PROFILE_URL, "contact");
  const rawTemplate = resolveTemplate(
    contactProfileJson as unknown as Parameters<typeof resolveTemplate>[0],
    "create-form",
  )!;
  return new CreateHalFormTemplate(rawTemplate, profile);
}

describe("resolveHalFormsFields", () => {
  it("defaults to one field per row, in template order, when no saved layout exists at all", () => {
    const { fields, layout } = resolveHalFormsFields(makeTemplate());
    expect(layout.sections).toHaveLength(1);
    expect(layout.sections[0].rows).toEqual(fields.map((field) => ({ fieldNames: [field.name] })));
  });

  it("keeps a saved two-field row's field order", () => {
    const { layout } = resolveHalFormsFields(makeTemplate(), [["email", "name"], ["phone"]]);
    expect(layout.sections[0].rows[0].fieldNames).toEqual(["email", "name"]);
  });

  it("marks a single-field row as its own row", () => {
    const { layout } = resolveHalFormsFields(makeTemplate(), [["name"], ["email"], ["phone"]]);
    expect(layout.sections[0].rows).toEqual([
      { fieldNames: ["name"] },
      { fieldNames: ["email"] },
      { fieldNames: ["phone"] },
    ]);
  });

  it("omits a field that exists on the template but is never named by the saved layout", () => {
    const { layout } = resolveHalFormsFields(makeTemplate(), [["name"]]);
    expect(layout.sections[0].rows).toEqual([{ fieldNames: ["name"] }]);
    const allNamedFields = layout.sections[0].rows.flatMap((row) => row.fieldNames);
    expect(allNamedFields).not.toContain("email");
    expect(allNamedFields).not.toContain("phone");
  });

  it("renders a field's first-listed occurrence only, ignoring a later duplicate reference", () => {
    const { layout } = resolveHalFormsFields(makeTemplate(), [
      ["name", "email"],
      ["email"],
      ["phone"],
    ]);
    expect(layout.sections[0].rows).toEqual([
      { fieldNames: ["name", "email"] },
      { fieldNames: ["phone"] },
    ]);
  });

  it("drops a saved row's reference to a field no longer on the template, without failing the rest", () => {
    const { layout } = resolveHalFormsFields(makeTemplate(), [["name", "ghost_field"], ["email"]]);
    expect(layout.sections[0].rows).toEqual([{ fieldNames: ["name"] }, { fieldNames: ["email"] }]);
  });

  it("drops a row entirely once every field it named is gone", () => {
    const { layout } = resolveHalFormsFields(makeTemplate(), [
      ["ghost_one", "ghost_two"],
      ["name"],
    ]);
    expect(layout.sections[0].rows).toEqual([{ fieldNames: ["name"] }]);
  });

  it("treats an empty saved layout the same as no saved layout", () => {
    const { fields, layout } = resolveHalFormsFields(makeTemplate(), []);
    expect(layout.sections[0].rows).toEqual(fields.map((field) => ({ fieldNames: [field.name] })));
  });
});

describe("resolveHalFormsFields autocomplete opt-in", () => {
  it("promotes an opted-in text field to the autocomplete kind", () => {
    const { fields } = resolveHalFormsFields(makeTemplate(), undefined, ["email"]);
    const email = fields.find((field) => field.name === "email");
    expect(email?.kind).toBe("autocomplete");
  });

  it("leaves every other field's kind unchanged", () => {
    const { fields } = resolveHalFormsFields(makeTemplate(), undefined, ["email"]);
    const name = fields.find((field) => field.name === "name");
    expect(name?.kind).toBe("text");
  });

  it("has no effect when no autocomplete field names are supplied", () => {
    const { fields } = resolveHalFormsFields(makeTemplate());
    expect(fields.every((field) => field.kind === "text")).toBe(true);
  });
});

describe("resolveHalFormsFields search-form autocomplete", () => {
  function makeSearchTemplate() {
    const profile = makeProfileEntity(contactSearchProfileJson, PROFILE_URL, "contact");
    const rawTemplate = resolveTemplate(
      contactSearchProfileJson as unknown as Parameters<typeof resolveTemplate>[0],
      "search",
    )!;
    return new SearchHalFormTemplate(rawTemplate, profile);
  }

  it("auto-classifies a prefix-match search property as autocomplete, carrying its search context", () => {
    const { fields } = resolveHalFormsFields(makeSearchTemplate());
    const name = fields.find((field) => field.name === "name~prefix");
    expect(name?.kind).toBe("autocomplete");
    if (name?.kind === "autocomplete") {
      expect(name.searchContext?.searchProperty.property.name).toBe("name~prefix");
      expect(name.searchContext?.profileEntity.name).toBe("contact");
    }
  });

  it("leaves an exact-match search property as a plain text field", () => {
    const { fields } = resolveHalFormsFields(makeSearchTemplate());
    const status = fields.find((field) => field.name === "status");
    expect(status?.kind).toBe("text");
  });

  it("does not inherit the relation's description onto its own relation-scoped fields", () => {
    const { fields } = resolveHalFormsFields(makeSearchTemplate());
    const companyName = fields.find((field) => field.name === "company.name~prefix");
    expect(companyName?.description).toBeUndefined();
  });
});

const contactSearchProfileJson = {
  name: "contact",
  description: "",
  _links: {
    self: { href: PROFILE_URL },
    describes: [
      { href: "https://example.com/contacts", name: "collection" },
      { href: "https://example.com/contacts/{id}", name: "item", templated: true },
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
        name: "name",
        title: "Name",
        type: "string",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [{ name: "name~prefix", title: "Name", type: "prefix-match" }],
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
    ],
    "blueprint:relation": [
      {
        name: "company",
        title: "Company",
        description: "The organization this contact works for",
        many_source_per_target: true,
        many_target_per_source: false,
        required: false,
        _links: { "blueprint:target-entity": { href: "https://example.com/profile/companies" } },
      },
    ],
  },
  _templates: {
    default: { method: "HEAD", target: "https://example.com/contacts", properties: [] },
    "create-form": { method: "POST", target: "https://example.com/contacts", properties: [] },
    search: {
      method: "GET",
      target: "https://example.com/contacts",
      properties: [
        { name: "name~prefix", type: "text" },
        { name: "status", type: "text" },
        { name: "company.name~prefix", type: "text" },
      ],
    },
  },
};
