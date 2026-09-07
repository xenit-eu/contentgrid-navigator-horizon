// Public export surface stays stable across the ACC-3128 FieldDescriptor/FieldRenderer/FieldError
// restructure (see docs/adr/ADR-004): `CreateEntityItemForm`/`CreateEntityItemFormProps` are now
// backed by `CreateEntityItemContainer` (the smart gating/state/mutation component) rather than
// the retired monolithic `create-entity-item-form.tsx` — both apps' route files need zero or
// near-zero changes.
export { CreateEntityItemContainer as CreateEntityItemForm } from "./create-entity-item-container";
export type { CreateEntityItemContainerProps as CreateEntityItemFormProps } from "./create-entity-item-container";
export { CreateEntityItemView } from "./create-entity-item-view";
export type { CreateEntityItemViewProps } from "./create-entity-item-view";
