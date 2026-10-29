import type { Ref } from "react";
import type { EntityItem } from "@contentgrid/navigator-data";
import {
  EditEntityItemContainer,
  type EditEntityItemFormHandle,
} from "../edit/edit-entity-item-container";
import { isEditableEntityItem } from "../edit/editable-entity-item";
import { EntityItemAttributes } from "./entity-item-attributes";

interface EditableEntityItemAttributesProps {
  /** While editing, the version the form was opened on (see `useEditContext`). */
  readonly item: EntityItem;
  /** Shows the update form in place of the attributes; ignored when the item can't be edited. */
  readonly isEditing: boolean;
  readonly onEditingChange: (isEditing: boolean) => void;
  /** Reloads the item after a version conflict and passes the latest version back down. */
  readonly onRefresh: () => void;
  /** Passed to {@link EntityItemAttributes} when not editing. */
  readonly auditTrail?: boolean;
  /** Handle to the update form while editing, e.g. to cancel it from outside. */
  readonly editFormRef?: Ref<EditEntityItemFormHandle>;
}

/**
 * An item's attributes, or its update form while editing. The form opens again when it is passed
 * another version of the item, so a refresh after a conflict shows the latest values.
 */
export function EditableEntityItemAttributes({
  item,
  isEditing,
  onEditingChange,
  onRefresh,
  auditTrail,
  editFormRef,
}: Readonly<EditableEntityItemAttributesProps>) {
  if (isEditing && isEditableEntityItem(item)) {
    return (
      <EditEntityItemContainer
        key={item.etag ?? undefined}
        item={item}
        onClose={() => onEditingChange(false)}
        onRefresh={onRefresh}
        ref={editFormRef}
      />
    );
  }
  return <EntityItemAttributes item={item} auditTrail={auditTrail} />;
}
