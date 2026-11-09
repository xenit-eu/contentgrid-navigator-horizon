// @contentgrid/features/hal-forms — generic HAL-Forms field renderer (x-stability: experimental)
// See specs/001-hal-form-layout/ for the feature spec, plan, and data model.

export type { HalFormsField, HalFormsFieldBase } from "./model/hal-forms-field";
export type { FieldRow, FieldSection, LayoutSchema } from "./model/layout-schema";
export {
  resolveHalFormsFields,
  type ResolvedHalFormsFields,
} from "./model/resolve-hal-forms-fields";
export { generateSearchFormLayout } from "./model/generate-search-form-layout";
export { HalFormsContainer, type HalFormsContainerProps } from "./render/hal-forms-container";
export {
  HalFormsFieldRenderer,
  type HalFormsFieldRendererProps,
} from "./render/hal-forms-field-renderer";
export type { FieldState, FieldValidationError } from "./state/field-error";
export { toServerFieldErrors } from "./state/to-server-field-errors";
export {
  useHalFormsFieldState,
  type UseHalFormsFieldState,
  type UseHalFormsFieldStateOptions,
} from "./state/use-hal-forms-field-state";
export type { FieldValidator } from "./validation/validate-field";
