import type { BooleanRendererProps } from "./boolean-renderer";
import type { DateTimeRendererProps } from "./datetime-renderer";
import type { EnumMultiRendererProps } from "./enum-multi-renderer";
import type { EnumRendererProps } from "./enum-renderer";
import type { NumberRendererProps } from "./number-renderer";
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
