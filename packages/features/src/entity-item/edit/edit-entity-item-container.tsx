import { type SubmitEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getValidationFieldErrors,
  isProblemWithStatus,
  isValidationProblem,
  toProblemDisplayModel,
  useUpdateEntityItem,
} from "@contentgrid/navigator-data";
import { UnsavedChangesDialog } from "@contentgrid/ui";
import { resolveHalFormsFields, toServerFieldErrors, useHalFormsFieldState } from "../../hal-forms";
import { ProblemAlert } from "../../problem-details";
import { capitalizeFirstLetter } from "../../string-utils";
import { useUnsavedChangesGuard } from "../../unsaved-changes-guard";
import { EditEntityItemForm } from "./edit-entity-item-form";
import type { EditableEntityItem } from "./editable-entity-item";

interface EditEntityItemContainerProps {
  readonly item: EditableEntityItem;
  /** Leaves edit mode: after the save, once the item has been reloaded, or on Cancel (confirmed
   * first when there are unsaved changes). */
  readonly onClose: () => void;
  /** Fired from a version conflict's Refresh: the caller reloads the item and passes it back down. */
  readonly onRefresh: () => void;
}

/**
 * The update form for an item, prefilled from `item.updateFormValues`; a save is conditional on
 * `item`'s ETag. On a version conflict (412) the alert offers Refresh, which asks the caller to
 * reload the item. Navigating away or cancelling with unsaved changes asks for confirmation first.
 */
export function EditEntityItemContainer({
  item,
  onClose,
  onRefresh,
}: Readonly<EditEntityItemContainerProps>) {
  const { updateTemplate } = item;
  const updateMutation = useUpdateEntityItem(item, {
    mutationOptions: {
      onSuccess: () => {
        toast.success(
          `${capitalizeFirstLetter(item.profileEntity.singularName)} has been successfully updated!`,
        );
        onClose();
      },
    },
  });
  const { fields, layout } = useMemo(() => resolveHalFormsFields(updateTemplate), [updateTemplate]);
  const formState = useHalFormsFieldState({
    fields,
    initialValues: item.updateFormValues ?? undefined,
    externalErrors: toServerFieldErrors(getValidationFieldErrors(updateMutation.error)),
  });

  const unsavedChangesGuard = useUnsavedChangesGuard(formState.isDirty);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    // Clears a previous attempt's errors before client-side validation can return early.
    updateMutation.reset();
    if (!formState.validate()) return;

    updateMutation.mutate(formState.buildValues(updateTemplate.template));
  }

  // A validation problem shows on its fields; every other error goes in the alert.
  const formAlertError =
    updateMutation.error && !isValidationProblem(updateMutation.error)
      ? toProblemDisplayModel(updateMutation.error)
      : undefined;

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
      <EditEntityItemForm
        fields={fields}
        layout={layout}
        values={formState.values}
        fieldState={formState.fieldState}
        onFieldChange={formState.setValue}
        onFieldBlur={formState.touchField}
        onSubmit={handleSubmit}
        isSaving={updateMutation.isPending}
        canSave={
          !isProblemWithStatus(updateMutation.error, 404) &&
          !isProblemWithStatus(updateMutation.error, 412)
        }
        onCancel={() => (formState.isDirty ? setIsConfirmingCancel(true) : onClose())}
        nonFieldErrorAlert={
          formAlertError && <ProblemAlert model={formAlertError} onRetryClick={onRefresh} />
        }
      />
    </>
  );
}
