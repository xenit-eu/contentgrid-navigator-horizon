import { useState } from "react";
import type { EntityItem, UpdateHalFormTemplate } from "@contentgrid/navigator-data";
import { UnsavedChangesDialog } from "@contentgrid/ui";
import { useUnsavedChangesGuard } from "../../unsaved-changes-guard";
import { EditEntityItemContainer } from "./edit-entity-item-container";

interface EditEntityItemViewProps {
  readonly item: EntityItem;
  /** The item's update form (`item.updateTemplate`). */
  readonly updateTemplate: UpdateHalFormTemplate;
  /** Leaves edit mode: after a successful save, or on Cancel (confirmed first when dirty). */
  readonly onClose: () => void;
}

/**
 * Edit mode for an item's attributes. Owns the unsaved-changes guard: navigating away or
 * cancelling with unsaved changes asks for confirmation first.
 */
export function EditEntityItemView({
  item,
  updateTemplate,
  onClose,
}: Readonly<EditEntityItemViewProps>) {
  const [isDirty, setIsDirty] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const unsavedChangesGuard = useUnsavedChangesGuard(isDirty);

  return (
    <>
      <UnsavedChangesDialog
        open={unsavedChangesGuard.isBlocked || isConfirmingCancel}
        onConfirm={unsavedChangesGuard.isBlocked ? unsavedChangesGuard.confirmNavigation : onClose}
        onCancel={
          unsavedChangesGuard.isBlocked
            ? unsavedChangesGuard.cancelNavigation
            : () => setIsConfirmingCancel(false)
        }
      />
      <EditEntityItemContainer
        item={item}
        updateTemplate={updateTemplate}
        onSaved={onClose}
        onCancel={() => (isDirty ? setIsConfirmingCancel(true) : onClose())}
        onDirtyChange={setIsDirty}
      />
    </>
  );
}
