import { type SubmitEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type EntityItem,
  type UpdateHalFormTemplate,
  getValidationFieldErrors,
  isProblemWithStatus,
  toProblemDisplayModel,
  useReloadEntityItem,
  useUpdateEntityItem,
} from "@contentgrid/navigator-data";
import {
  getFormAlertError,
  resolveHalFormsFields,
  toServerFieldErrors,
  useHalFormsFieldState,
} from "../../hal-forms";
import { ProblemAlert } from "../../problem-details";
import { capitalizeFirstLetter } from "../../string-utils";
import { EditEntityItemForm } from "./edit-entity-item-form";

interface EditEntityItemContainerProps {
  /** The version of the item the form opens with. */
  readonly item: EntityItem;
  /** The item's update form (`item.updateTemplate`). */
  readonly updateTemplate: UpdateHalFormTemplate;
  /** Fired after the save, once the item has been reloaded. */
  readonly onSaved: () => void;
  readonly onCancel: () => void;
  /** Fired whenever the form's dirty state changes; the caller owns the unsaved-changes guard. */
  readonly onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * The update form for an item, prefilled from `item.updateFormValues`. It keeps the item it was
 * opened with, so a reload of the item while editing changes neither the form nor the version a
 * save is conditional on. On a version conflict (412) the item is reloaded and the form moves onto
 * the latest version with the user's own changes on top; the next save is conditional on that
 * version. The conflict stays in the form's alert until the next save.
 */
export function EditEntityItemContainer({
  item,
  updateTemplate,
  onSaved,
  onCancel,
  onDirtyChange,
}: Readonly<EditEntityItemContainerProps>) {
  const [edited, setEdited] = useState({ item, updateTemplate });
  const updateMutation = useUpdateEntityItem(edited.item);
  const reloadEntityItem = useReloadEntityItem(edited.item);
  const [isReloading, setIsReloading] = useState(false);
  const { fields, layout } = useMemo(
    () => resolveHalFormsFields(edited.updateTemplate),
    [edited.updateTemplate],
  );
  const formState = useHalFormsFieldState({
    fields,
    initialValues: edited.item.updateFormValues ?? undefined,
    externalErrors: toServerFieldErrors(getValidationFieldErrors(updateMutation.error)),
  });

  useEffect(() => {
    onDirtyChange?.(formState.isDirty);
  }, [formState.isDirty, onDirtyChange]);

  async function reloadAfterConflict() {
    setIsReloading(true);
    // A failed reload puts the item query in its error state, which the item view shows.
    const latest = await reloadEntityItem().catch(() => undefined);
    setIsReloading(false);
    const latestTemplate = latest?.updateTemplate;
    if (!latest || !latestTemplate) return;
    formState.updateInitialValues(latest.updateFormValues ?? {});
    setEdited({ item: latest, updateTemplate: latestTemplate });
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    // Clears a previous attempt's errors before client-side validation can return early.
    updateMutation.reset();
    if (!formState.validate()) return;

    updateMutation.mutate(formState.buildValues(edited.updateTemplate.template), {
      onSuccess: () => {
        toast.success(
          `${capitalizeFirstLetter(item.profileEntity.singularName)} has been successfully updated!`,
        );
        onSaved();
      },
      onError: (error) => {
        if (isProblemWithStatus(error, 412)) void reloadAfterConflict();
      },
    });
  }

  const formAlertError = getFormAlertError(updateMutation.error, fields);

  return (
    <EditEntityItemForm
      fields={fields}
      layout={layout}
      values={formState.values}
      fieldState={formState.fieldState}
      onFieldChange={formState.setValue}
      onFieldBlur={formState.touchField}
      onSubmit={handleSubmit}
      isSaving={updateMutation.isPending || isReloading}
      canSave={!isProblemWithStatus(updateMutation.error, 404)}
      onCancel={onCancel}
      nonFieldErrorAlert={
        formAlertError && <ProblemAlert model={toProblemDisplayModel(formAlertError)} />
      }
    />
  );
}
