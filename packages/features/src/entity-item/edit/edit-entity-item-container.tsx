import { type SubmitEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type ContentChanges,
  type FieldValueMap,
  getValidationFieldErrors,
  isProblemWithStatus,
  isValidationProblem,
  toProblemDisplayModel,
  useApplyContentChanges,
  useUpdateEntityItem,
} from "@contentgrid/navigator-data";
import { UnsavedChangesDialog } from "@contentgrid/ui";
import {
  HalFormsContainer,
  resolveHalFormsFields,
  toServerFieldErrors,
  useHalFormsFieldState,
} from "../../hal-forms";
import { ProblemAlert } from "../../problem-details";
import { capitalizeFirstLetter } from "../../string-utils";
import { useUnsavedChangesGuard } from "../../unsaved-changes-guard";
import {
  changedFileMetadataValues,
  initialFormValues,
  layoutWithoutContentMetadata,
  metadataFieldsLayout,
  storedMetadataValues,
} from "./content-metadata-fields";
import { EditContentFields, contentAttributeLabel } from "./edit-content-fields";
import { EditEntityItemForm } from "./edit-entity-item-form";
import type { EditableEntityItem } from "./editable-entity-item";
import { withContentChange } from "./with-content-change";

interface EditEntityItemContainerProps {
  readonly item: EditableEntityItem;
  /** Leaves edit mode: after the save, once the item has been reloaded, or on Cancel (confirmed
   * first when there are unsaved changes). */
  readonly onClose: () => void;
  /** Fired from a version conflict's Refresh: the caller reloads the item and passes it back down. */
  readonly onRefresh: () => void;
  /** Files picked or removed in the form, applied on Save (see `useEntityItemContext`). */
  readonly pendingContent: ContentChanges;
  readonly onPendingContentChange: (pendingContent: ContentChanges) => void;
  /** See `EditContentFields`. */
  readonly previewedAttributeName?: string;
  readonly onPreview?: (attributeName: string) => void;
}

/**
 * The update form for an item, prefilled from `item.updateFormValues`; a save is conditional on
 * `item`'s ETag. On a version conflict (412) the alert offers Refresh, which asks the caller to
 * reload the item. Navigating away or cancelling with unsaved changes asks for confirmation first.
 *
 * Each file's filename and mimetype fields show under its file field, not in the field list.
 * Picked and removed files wait until Save; meanwhile those fields show the picked file. The
 * metadata is saved first, with the stored filename and mimetype of every changed file, so a file
 * that changed since the form was opened fails the save with 412 before any file is sent; then the
 * file changes are applied, a picked file under the name in its filename field. When one of them
 * fails, a toast names it and the form moves onto the item as it is stored now, keeping only the
 * failed changes, so Save tries just those again.
 */
export function EditEntityItemContainer({
  item,
  onClose,
  onRefresh,
  pendingContent,
  onPendingContentChange,
  previewedAttributeName,
  onPreview,
}: Readonly<EditEntityItemContainerProps>) {
  const { updateTemplate } = item;
  // With file changes queued, the file step refreshes the item once it is done.
  const updateMutation = useUpdateEntityItem(item, {
    invalidateOnSuccess: pendingContent.size === 0,
  });
  const contentMutation = useApplyContentChanges(item);
  const { fields, layout } = useMemo(() => {
    const resolved = resolveHalFormsFields(updateTemplate);
    return { fields: resolved.fields, layout: layoutWithoutContentMetadata(item, resolved.layout) };
  }, [item, updateTemplate]);
  const [initialValues] = useState(() => initialFormValues(item, pendingContent));
  const formState = useHalFormsFieldState({
    fields,
    initialValues,
    externalErrors: toServerFieldErrors(getValidationFieldErrors(updateMutation.error)),
  });

  useSyncFileMetadataFields(item, pendingContent, formState.setValues);

  const isDirty = formState.isDirty || pendingContent.size > 0;
  const unsavedChangesGuard = useUnsavedChangesGuard(isDirty);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    // Clears a previous attempt's errors before client-side validation can return early.
    updateMutation.reset();
    if (!formState.validate()) return;

    updateMutation.mutate(valuesToSave(), {
      onSuccess: () => {
        if (pendingContent.size === 0) {
          finishSave();
          return;
        }
        contentMutation.mutate(
          { changes: pendingContent, filenames: pickedFilenames() },
          { onSuccess: handleContentChangesSaved },
        );
      },
    });
  }

  /** The form values, with the stored filename and mimetype of every changed file: the file
   * requests set those, and until they succeed the stored file keeps its own. */
  function valuesToSave() {
    const storedMetadata = [...pendingContent.keys()].flatMap((attributeName) =>
      Object.entries(storedMetadataValues(item, attributeName)),
    );
    return storedMetadata.reduce(
      (values, [name, storedValue]) =>
        storedValue === undefined ? values.withoutValue(name) : values.withValue(name, storedValue),
      formState.buildValues(updateTemplate.template),
    );
  }

  /** The name in each picked file's filename field, which the file is stored under. */
  function pickedFilenames(): ReadonlyMap<string, string> {
    const filenames = new Map<string, string>();
    for (const [attributeName, file] of pendingContent) {
      const { filename } = updateTemplate.contentMetadataPropertyNames(attributeName);
      const value = filename === undefined ? undefined : formState.values[filename];
      if (file && typeof value === "string" && value !== "") filenames.set(attributeName, value);
    }
    return filenames;
  }

  function handleContentChangesSaved(failures: ReadonlyMap<string, Error>) {
    if (failures.size === 0) {
      finishSave();
      return;
    }
    for (const [attributeName, error] of failures) {
      const label = contentAttributeLabel(item, attributeName);
      toast.error(
        `Changes saved, but the file of ${label} was not: ${toProblemDisplayModel(error).title}`,
      );
    }
    // The metadata is saved already: the form moves onto the latest version of the item, with
    // only the failed changes still waiting.
    onPendingContentChange(
      new Map([...pendingContent].filter(([attributeName]) => failures.has(attributeName))),
    );
    onRefresh();
  }

  function finishSave() {
    toast.success(
      `${capitalizeFirstLetter(item.profileEntity.singularName)} has been successfully updated!`,
    );
    onClose();
  }

  function handleContentChange(attributeName: string, file: File | null) {
    onPendingContentChange(withContentChange(pendingContent, item, attributeName, file));
    // A picked file comes into view in the content preview.
    if (file) onPreview?.(attributeName);
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
        isSaving={updateMutation.isPending || contentMutation.isPending}
        canSave={
          !isProblemWithStatus(updateMutation.error, 404) &&
          !isProblemWithStatus(updateMutation.error, 412)
        }
        onCancel={() => (isDirty ? setIsConfirmingCancel(true) : onClose())}
        nonFieldErrorAlert={
          formAlertError && <ProblemAlert model={formAlertError} onRetryClick={onRefresh} />
        }
        contentFields={
          <EditContentFields
            item={item}
            pendingContent={pendingContent}
            onContentChange={handleContentChange}
            uploadProgress={contentMutation.isPending ? contentMutation.progress : undefined}
            renderMetadataFields={(attributeName) => (
              <HalFormsContainer
                fields={fields}
                layout={metadataFieldsLayout(item, attributeName)}
                values={formState.values}
                onChange={formState.setValue}
                onFieldBlur={formState.touchField}
                fieldState={formState.fieldState}
              />
            )}
            previewedAttributeName={previewedAttributeName}
            onPreview={onPreview}
          />
        }
      />
    </>
  );
}

/**
 * Keeps the filename and mimetype fields in step with the file changes, whether they were made in
 * the form or in the content preview: a changed file's fields show the picked file (none for a
 * removed one), and a change that is taken back shows the stored values again.
 */
function useSyncFileMetadataFields(
  item: EditableEntityItem,
  pendingContent: ContentChanges,
  setValues: (values: FieldValueMap) => void,
) {
  const [previousPendingContent, setPreviousPendingContent] = useState(pendingContent);
  if (pendingContent === previousPendingContent) return;

  // Updating state while rendering, as React's docs describe for a value that follows a prop.
  setPreviousPendingContent(pendingContent);
  const attributeNames = new Set([...previousPendingContent.keys(), ...pendingContent.keys()]);
  for (const attributeName of attributeNames) {
    const file = pendingContent.get(attributeName);
    if (file === previousPendingContent.get(attributeName)) continue;
    setValues(
      file === undefined
        ? storedMetadataValues(item, attributeName)
        : changedFileMetadataValues(item, attributeName, file),
    );
  }
}
