import type { FieldOptionsSource, RenderFieldDescriptor } from "@contentgrid/navigator-data/schema";

/**
 * `property` carries the raw HAL-FORMS property (see render-field-descriptor.ts) but no
 * renderer in this directory reads it — `packages/ui` can't import
 * `@contentgrid/hal-forms` to construct a real one (see packages/ui/CLAUDE.md's
 * forbidden-imports rule), so tests/stories stand in a dummy value typed via
 * `RenderFieldDescriptor["property"]` rather than importing the real type.
 */
const DUMMY_PROPERTY = {} as unknown as RenderFieldDescriptor["property"];

/**
 * `SimpleLink` (the real type of `link` below) is a class with private fields —
 * an object literal can't structurally satisfy it, and `packages/ui` can't
 * import `@contentgrid/hal` to construct a real instance. Same dummy-cast
 * approach as `DUMMY_PROPERTY` above.
 */
const DUMMY_LINK = {} as unknown as Extract<FieldOptionsSource, { kind: "remote" }>["link"];

const INLINE_OPTIONS: FieldOptionsSource = {
  kind: "inline",
  options: [
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "archived", label: "Archived" },
  ],
};

const REMOTE_OPTIONS: FieldOptionsSource = {
  kind: "remote",
  link: DUMMY_LINK,
};

export function textField(
  overrides: Partial<Extract<RenderFieldDescriptor, { type: "text" }>> = {},
): Extract<RenderFieldDescriptor, { type: "text" }> {
  return {
    name: "name",
    label: "Name",
    required: false,
    readOnly: false,
    property: DUMMY_PROPERTY,
    type: "text",
    regex: /.*/,
    minLength: 0,
    maxLength: 0,
    ...overrides,
  };
}

export function numberField(
  overrides: Partial<Extract<RenderFieldDescriptor, { type: "number" }>> = {},
): Extract<RenderFieldDescriptor, { type: "number" }> {
  return {
    name: "quantity",
    label: "Quantity",
    required: false,
    readOnly: false,
    property: DUMMY_PROPERTY,
    type: "number",
    ...overrides,
  };
}

export function booleanField(
  overrides: Partial<Extract<RenderFieldDescriptor, { type: "boolean" }>> = {},
): Extract<RenderFieldDescriptor, { type: "boolean" }> {
  return {
    name: "active",
    label: "Active",
    required: false,
    readOnly: false,
    property: DUMMY_PROPERTY,
    type: "boolean",
    ...overrides,
  };
}

export function datetimeField(
  overrides: Partial<Extract<RenderFieldDescriptor, { type: "datetime" }>> = {},
): Extract<RenderFieldDescriptor, { type: "datetime" }> {
  return {
    name: "dueDate",
    label: "Due date",
    required: false,
    readOnly: false,
    property: DUMMY_PROPERTY,
    type: "datetime",
    includesTime: false,
    ...overrides,
  };
}

export function enumField(
  overrides: Partial<Extract<RenderFieldDescriptor, { type: "enum" }>> = {},
): Extract<RenderFieldDescriptor, { type: "enum" }> {
  return {
    name: "status",
    label: "Status",
    required: false,
    readOnly: false,
    property: DUMMY_PROPERTY,
    type: "enum",
    optionsSource: INLINE_OPTIONS,
    ...overrides,
  };
}

export function enumMultiField(
  overrides: Partial<Extract<RenderFieldDescriptor, { type: "enum-multi" }>> = {},
): Extract<RenderFieldDescriptor, { type: "enum-multi" }> {
  return {
    name: "tags",
    label: "Tags",
    required: false,
    readOnly: false,
    property: DUMMY_PROPERTY,
    type: "enum-multi",
    optionsSource: INLINE_OPTIONS,
    ...overrides,
  };
}

export function fileField(
  overrides: Partial<Extract<RenderFieldDescriptor, { type: "file" }>> = {},
): Extract<RenderFieldDescriptor, { type: "file" }> {
  return {
    name: "attachment",
    label: "Attachment",
    required: false,
    readOnly: false,
    property: DUMMY_PROPERTY,
    type: "file",
    multiple: false,
    ...overrides,
  };
}

export function relationToOneField(
  overrides: Partial<Extract<RenderFieldDescriptor, { type: "relation-to-one" }>> = {},
): Extract<RenderFieldDescriptor, { type: "relation-to-one" }> {
  return {
    name: "supplier",
    label: "Supplier",
    required: false,
    readOnly: false,
    property: DUMMY_PROPERTY,
    type: "relation-to-one",
    targetCollectionHref: "https://api.example.com/suppliers",
    ...overrides,
  };
}

export function relationToManyField(
  overrides: Partial<Extract<RenderFieldDescriptor, { type: "relation-to-many" }>> = {},
): Extract<RenderFieldDescriptor, { type: "relation-to-many" }> {
  return {
    name: "products",
    label: "Products",
    required: false,
    readOnly: false,
    property: DUMMY_PROPERTY,
    type: "relation-to-many",
    targetCollectionHref: "https://api.example.com/products",
    ...overrides,
  };
}

export { REMOTE_OPTIONS };
