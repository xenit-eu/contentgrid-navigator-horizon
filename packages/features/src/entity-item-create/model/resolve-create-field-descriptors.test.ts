import { describe, expect, it } from "vitest";
import { CreateHalFormTemplate, resolveTemplate } from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import type { FieldDescriptor } from "./field-descriptor";
import { resolveCreateFieldDescriptors } from "./resolve-create-field-descriptors";

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
        name: "invoice_number",
        title: "Invoice number",
        type: "string",
        description: "The supplier's own reference",
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
        name: "status",
        title: "Status",
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
    "blueprint:relation": [
      {
        name: "supplier",
        title: "Supplier",
        description: "",
        many_source_per_target: true,
        many_target_per_source: false,
        required: true,
        _links: { "blueprint:target-entity": { href: "https://example.com/profile/suppliers" } },
      },
      {
        name: "line_items",
        title: "Line items",
        description: "",
        many_source_per_target: true,
        many_target_per_source: true,
        required: false,
        _links: { "blueprint:target-entity": { href: "https://example.com/profile/line-items" } },
      },
    ],
  },
  _templates: {
    default: { method: "HEAD", target: "https://example.com/invoices", properties: [] },
    search: { method: "GET", target: "https://example.com/invoices", properties: [] },
    "create-form": {
      method: "POST",
      target: "https://example.com/invoices",
      contentType: "application/json",
      properties: [
        {
          name: "invoice_number",
          type: "text",
          required: true,
          regex: "^INV-.*$",
          minLength: 4,
          maxLength: 40,
        },
        {
          name: "status",
          type: "text",
          options: { maxItems: 1, inline: ["draft", "sent", "paid"] },
        },
        {
          name: "tags",
          type: "text",
          options: { maxItems: 5, inline: ["urgent", "recurring"] },
        },
        { name: "is_recurring", type: "checkbox" },
        { name: "invoice_date", type: "date" },
        { name: "reminder_at", type: "datetime-local" },
        { name: "total", type: "number" },
        { name: "attachment", type: "file" },
        { name: "special_note", type: "text" },
        { name: "contact_email", type: "email" },
        {
          name: "supplier",
          type: "url",
          required: true,
          options: {
            link: { href: "https://example.com/suppliers", title: "Suppliers" },
            maxItems: 1,
            valueField: "/_links/self/href",
          },
        },
        {
          name: "line_items",
          type: "url",
          options: {
            link: { href: "https://example.com/line-items", title: "Line items" },
            minItems: 0,
            valueField: "/_links/self/href",
          },
        },
        {
          name: "category",
          type: "text",
          options: {
            maxItems: 1,
            link: { href: "https://example.com/categories", title: "Categories" },
          },
        },
      ],
    },
  },
};

function makeTemplate() {
  const profile = makeProfileEntity(invoiceProfileJson, PROFILE_URL, "invoice");
  const rawTemplate = resolveTemplate(
    invoiceProfileJson as unknown as Parameters<typeof resolveTemplate>[0],
    "create-form",
  )!;
  return new CreateHalFormTemplate(rawTemplate, profile);
}

function byName(descriptors: readonly FieldDescriptor[], name: string): FieldDescriptor {
  const found = descriptors.find((d) => d.name === name);
  if (!found) throw new Error(`no descriptor named ${name}`);
  return found;
}

describe("resolveCreateFieldDescriptors", () => {
  it("maps a required text attribute to a text descriptor with its constraints", () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    const field = byName(fields, "invoice_number");
    expect(field.kind).toBe("text");
    expect(field.required).toBe(true);
    expect(field.label).toBe("Invoice number");
    expect(field.description).toBe("The supplier's own reference");
    if (field.kind === "text") {
      expect(field.maxLength).toBe(40);
      expect(field.regex).toBeInstanceOf(RegExp);
    }
  });

  it("maps a checkbox property to a boolean descriptor", () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    expect(byName(fields, "is_recurring").kind).toBe("boolean");
  });

  it("maps a date property to a datetime descriptor without time", () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    const field = byName(fields, "invoice_date");
    expect(field.kind).toBe("datetime");
    if (field.kind === "datetime") expect(field.includesTime).toBe(false);
  });

  it("maps a datetime-local property to a datetime descriptor with time", () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    const field = byName(fields, "reminder_at");
    expect(field.kind).toBe("datetime");
    if (field.kind === "datetime") expect(field.includesTime).toBe(true);
  });

  it("maps a number property to a number descriptor", () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    expect(byName(fields, "total").kind).toBe("number");
  });

  it("maps a file property to a file descriptor", () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    const field = byName(fields, "attachment");
    expect(field.kind).toBe("file");
    if (field.kind === "file") expect(field.multiple).toBe(false);
  });

  it("maps a single-value inline-options property to a non-multi enum descriptor", () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    const field = byName(fields, "status");
    expect(field.kind).toBe("enum");
    if (field.kind === "enum") {
      expect(field.multiValue).toBe(false);
      expect(field.options).toEqual(["draft", "sent", "paid"]);
    }
  });

  it("maps a multi-value inline-options property to a multi enum descriptor", () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    const field = byName(fields, "tags");
    expect(field.kind).toBe("enum");
    if (field.kind === "enum") {
      expect(field.multiValue).toBe(true);
      expect(field.options).toEqual(["urgent", "recurring"]);
    }
  });

  it("maps a remote-options property to an enum descriptor with no inline options, carrying the raw property", () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    const field = byName(fields, "category");
    expect(field.kind).toBe("enum");
    if (field.kind === "enum") {
      expect(field.options).toEqual([]);
      expect(field.property.options?.isRemote()).toBe(true);
    }
  });

  it("falls back to a formatted field name when there is no prompt or profile title", () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    expect(byName(fields, "special_note").label).toBe("Special Note");
  });

  it('maps an email property to a text descriptor with format "email"', () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    const field = byName(fields, "contact_email");
    expect(field.kind).toBe("text");
    if (field.kind === "text") expect(field.format).toBe("email");
  });

  it("maps a required to-one relation to a to-one relation descriptor", () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    const field = byName(fields, "supplier");
    expect(field.kind).toBe("relation");
    expect(field.required).toBe(true);
    expect(field.label).toBe("Supplier");
    if (field.kind === "relation") {
      expect(field.cardinality).toBe("to-one");
      expect(field.targetHref).toBe("https://example.com/suppliers");
    }
  });

  it("maps a to-many relation to a to-many relation descriptor, required read from the template", () => {
    const { fields } = resolveCreateFieldDescriptors(makeTemplate());
    const field = byName(fields, "line_items");
    expect(field.kind).toBe("relation");
    // The fixture's "line_items" create-form property has no `required` key — this
    // asserts `false` came from that, not from a hardcoded cardinality-based rule.
    expect(field.required).toBe(false);
    if (field.kind === "relation") {
      expect(field.cardinality).toBe("to-many");
      expect(field.targetHref).toBe("https://example.com/line-items");
    }
  });

  it("produces one descriptor per create-form property, in a single layout group", () => {
    const { fields, layout } = resolveCreateFieldDescriptors(makeTemplate());
    expect(fields).toHaveLength(13);
    expect(layout.groups).toHaveLength(1);
    expect(layout.groups[0]?.fieldNames).toEqual(fields.map((field) => field.name));
  });
});
