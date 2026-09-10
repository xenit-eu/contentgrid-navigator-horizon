import type { BooleanRendererProps } from "./boolean-renderer";
import type { DateTimeRendererProps } from "./datetime-renderer";
import type { EnumMultiRendererProps } from "./enum-multi-renderer";
import type { EnumRendererProps } from "./enum-renderer";
import type { NumberRendererProps } from "./number-renderer";
import type { RelationToManyRendererProps } from "./relation-to-many-renderer";
import type { RelationToOneRendererProps } from "./relation-to-one-renderer";
import type { TextRendererProps } from "./text-renderer";

/** Every renderer's fixture omits `value`/`onChange` — those vary per test/story and are
 * supplied at the call site, spread alongside the fixture's base props. */
type BaseProps<T> = Omit<T, "value" | "onChange">;

export function textField(
  overrides: Partial<BaseProps<TextRendererProps>> = {},
): BaseProps<TextRendererProps> {
  return {
    name: "name",
    label: "Name",
    required: false,
    readOnly: false,
    ...overrides,
  };
}

export function numberField(
  overrides: Partial<BaseProps<NumberRendererProps>> = {},
): BaseProps<NumberRendererProps> {
  return {
    name: "quantity",
    label: "Quantity",
    required: false,
    readOnly: false,
    ...overrides,
  };
}

export function booleanField(
  overrides: Partial<BaseProps<BooleanRendererProps>> = {},
): BaseProps<BooleanRendererProps> {
  return {
    name: "active",
    label: "Active",
    required: false,
    readOnly: false,
    ...overrides,
  };
}

export function datetimeField(
  overrides: Partial<BaseProps<DateTimeRendererProps>> = {},
): BaseProps<DateTimeRendererProps> {
  return {
    name: "dueDate",
    label: "Due date",
    required: false,
    readOnly: false,
    includesTime: false,
    ...overrides,
  };
}

const INLINE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function enumField(
  overrides: Partial<BaseProps<EnumRendererProps>> = {},
): BaseProps<EnumRendererProps> {
  return {
    name: "status",
    label: "Status",
    required: false,
    readOnly: false,
    options: INLINE_STATUS_OPTIONS,
    ...overrides,
  };
}

export function enumMultiField(
  overrides: Partial<BaseProps<EnumMultiRendererProps>> = {},
): BaseProps<EnumMultiRendererProps> {
  return {
    name: "tags",
    label: "Tags",
    required: false,
    readOnly: false,
    options: INLINE_STATUS_OPTIONS,
    ...overrides,
  };
}

export function relationToOneField(
  overrides: Partial<BaseProps<RelationToOneRendererProps>> = {},
): BaseProps<RelationToOneRendererProps> {
  return {
    name: "supplier",
    label: "Supplier",
    required: false,
    readOnly: false,
    ...relationPickerDefaults(),
    ...overrides,
  };
}

export function relationToManyField(
  overrides: Partial<BaseProps<RelationToManyRendererProps>> = {},
): BaseProps<RelationToManyRendererProps> {
  return {
    name: "products",
    label: "Products",
    required: false,
    readOnly: false,
    ...relationPickerDefaults(),
    ...overrides,
  };
}

/** Neutral picker-plumbing defaults shared by the relation-to-one/relation-to-many fixtures —
 * a caller overriding one of these (e.g. a story supplying real `options`) spreads over it. */
function relationPickerDefaults() {
  return {
    options: [],
    isLoading: false,
    searchQuery: "",
    onSearch: () => {},
    hasPreviousPage: false,
    hasNextPage: false,
    onPreviousPage: () => {},
    onNextPage: () => {},
    selectedItemsData: {},
    onItemResolved: () => {},
  };
}
