import { describe, expect, it } from "vitest";
import { resolveTemplate } from "@contentgrid/hal-forms";
import { CreateHalFormTemplate } from "../accessors/extended-forms/create-form";
import { makeProfileEntity } from "../accessors/extended-forms/test-utils";
import type { ProfileEntityShape } from "../shapes";
import { createFormToRenderFields } from "./create-form-to-render-fields";
import type { RenderFieldDescriptor } from "./render-field-descriptor";

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
  const rawTemplate = resolveTemplate(invoiceProfileJson as ProfileEntityShape, "create-form")!;
  return new CreateHalFormTemplate(rawTemplate, profile);
}

function byName(descriptors: RenderFieldDescriptor[], name: string): RenderFieldDescriptor {
  const found = descriptors.find((d) => d.name === name);
  if (!found) throw new Error(`no descriptor named ${name}`);
  return found;
}

describe("createFormToRenderFields", () => {
  it("maps a required text attribute to a text descriptor with its constraints", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    const field = byName(descriptors, "invoice_number");
    expect(field.type).toBe("text");
    expect(field.required).toBe(true);
    expect(field.label).toBe("Invoice number");
    expect(field.description).toBe("The supplier's own reference");
    if (field.type === "text") {
      expect(field.minLength).toBe(4);
      expect(field.maxLength).toBe(40);
    }
  });

  it("maps a checkbox property to a boolean descriptor", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    expect(byName(descriptors, "is_recurring").type).toBe("boolean");
  });

  it("maps a date property to a datetime descriptor without time", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    const field = byName(descriptors, "invoice_date");
    expect(field.type).toBe("datetime");
    if (field.type === "datetime") expect(field.includesTime).toBe(false);
  });

  it("maps a datetime-local property to a datetime descriptor with time", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    const field = byName(descriptors, "reminder_at");
    expect(field.type).toBe("datetime");
    if (field.type === "datetime") expect(field.includesTime).toBe(true);
  });

  it("maps a number property to a number descriptor", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    expect(byName(descriptors, "total").type).toBe("number");
  });

  it("maps a file property to a file descriptor", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    const field = byName(descriptors, "attachment");
    expect(field.type).toBe("file");
    if (field.type === "file") expect(field.multiple).toBe(false);
  });

  it("maps a single-value inline-options property to an enum descriptor", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    const field = byName(descriptors, "status");
    expect(field.type).toBe("enum");
    if (field.type === "enum" && field.optionsSource.kind === "inline") {
      expect(field.optionsSource.options.map((o) => o.value)).toEqual(["draft", "sent", "paid"]);
    }
  });

  it("maps a multi-value inline-options property to an enum-multi descriptor", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    const field = byName(descriptors, "tags");
    expect(field.type).toBe("enum-multi");
    if (field.type === "enum-multi" && field.optionsSource.kind === "inline") {
      expect(field.optionsSource.options.map((o) => o.value)).toEqual(["urgent", "recurring"]);
    }
  });

  it("maps a remote-options property to an enum descriptor with a link", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    const field = byName(descriptors, "category");
    expect(field.type).toBe("enum");
    if (field.type === "enum") {
      expect(field.optionsSource.kind).toBe("remote");
      if (field.optionsSource.kind === "remote") {
        expect(field.optionsSource.link.href).toBe("https://example.com/categories");
      }
    }
  });

  it("falls back to a formatted field name when there is no prompt or profile title", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    expect(byName(descriptors, "special_note").label).toBe("Special Note");
  });

  it("maps a required to-one relation to a relation-to-one descriptor", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    const field = byName(descriptors, "supplier");
    expect(field.type).toBe("relation-to-one");
    expect(field.required).toBe(true);
    expect(field.label).toBe("Supplier");
    if (field.type === "relation-to-one") {
      expect(field.targetCollectionHref).toBe("https://example.com/suppliers");
      expect(field.profileRelation?.name).toBe("supplier");
    }
  });

  it("maps a to-many relation to a relation-to-many descriptor that is never required", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    const field = byName(descriptors, "line_items");
    expect(field.type).toBe("relation-to-many");
    expect(field.required).toBe(false);
    if (field.type === "relation-to-many") {
      expect(field.targetCollectionHref).toBe("https://example.com/line-items");
    }
  });

  it("produces one descriptor per create-form property", () => {
    const descriptors = createFormToRenderFields(makeTemplate());
    expect(descriptors).toHaveLength(12);
  });
});
