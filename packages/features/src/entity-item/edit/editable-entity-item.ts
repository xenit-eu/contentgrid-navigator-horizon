import type { EntityItem, UpdateHalFormTemplate } from "@contentgrid/navigator-data";

/** An item whose update form has at least one property. */
export type EditableEntityItem = EntityItem & { readonly updateTemplate: UpdateHalFormTemplate };

export function isEditableEntityItem(item: EntityItem): item is EditableEntityItem {
  const { updateTemplate } = item;
  return updateTemplate !== null && updateTemplate.userDefinedProperties.length > 0;
}
