import { type SubmitEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type CreateHalFormTemplate,
  type EntityItem,
  type FieldValue,
  type ProfileEntity,
  getValidationFieldErrors,
  isValidationProblem,
  toProblemDisplayModel,
  useCreateEntityItem,
} from "@contentgrid/navigator-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  SPLIT_BREAKPOINT_QUERY,
  useMediaQuery,
} from "@contentgrid/ui";
import type { RelationItemClickHandler, RelationItemCreateHandler } from "../entity-item";
import {
  type FieldValidationError,
  type HalFormsFilePreview,
  resolveHalFormsFields,
  toServerFieldErrors,
  useHalFormsFieldState,
} from "../hal-forms";
import {
  ProblemAlert,
  type RelationConflictAlertProps,
  type ValidationAlertProps,
} from "../problem-details";
import { capitalizeFirstLetter } from "../string-utils";
import { CreateEntityItemFilePreview } from "./create-entity-item-file-preview";
import { CreateEntityItemForm } from "./create-entity-item-form";
import { useCreateEntityItemState } from "./state/create-entity-item-state";

export interface CreateEntityItemContainerProps {
  readonly profile: ProfileEntity;
  /** Fired after the item is created; typically used to navigate to the new item. */
  readonly onCreated?: (item: EntityItem) => void;
  /** Renders a cancel button next to submit when provided. */
  readonly onCancel?: () => void;
  /**
   * Fired whenever the form's dirty state changes. This form has no router or
   * navigation-guard knowledge itself — it stays usable outside a routed context and
   * in tests without one; a caller that wants to warn on navigating away with unsaved
   * changes (see `useUnsavedChangesGuard` in `@contentgrid/features/unsaved-changes-guard`)
   * tracks this signal and owns the guard itself.
   */
  readonly onDirtyChange?: (isDirty: boolean) => void;
  /** Opens a linked item, as legacy's relation "details" action. */
  readonly onRelationItemClick?: RelationItemClickHandler;
  /** Fired from a relation picker's "Create" button with the target entity's profile name. */
  readonly onRelationItemCreateNew?: RelationItemCreateHandler;
  /**
   * Fires for a `duplicate` entity-level validation error (HTTP 400) — e.g. a unique
   * constraint spanning fields the create-form doesn't render inline. Receives the
   * conflicting item's href.
   */
  readonly onConflictingItemClick?: ValidationAlertProps["onConflictingItemClick"];
  /**
   * Fires for a `missing-relation-target` entity-level validation error (HTTP 400) — a
   * linked href no longer resolves to an entity item. Receives the dangling href.
   */
  readonly onMissingRelationTargetClick?: ValidationAlertProps["onMissingRelationTargetClick"];
  /**
   * Fires for an `allowed-values` entity-level validation error (HTTP 400). Receives the
   * allowed values from the problem body.
   */
  readonly onAllowedValuesClick?: ValidationAlertProps["onAllowedValuesClick"];
  /**
   * Fires for a `type`/`type-format` entity-level validation error (HTTP 400). Receives
   * the expected/actual type info from the problem body.
   */
  readonly onExpectedTypeClick?: ValidationAlertProps["onExpectedTypeClick"];
  /**
   * Fires for a `blindRelationOverwrite` entity-level error (HTTP 409) — a to-one relation
   * set by this create would silently overwrite an existing link. Receives the conflicting
   * link info.
   */
  readonly onBlindRelationOverwriteClick?: RelationConflictAlertProps["onBlindRelationOverwriteClick"];
  /**
   * Fires for a `requiredRelation` entity-level error (HTTP 409). Receives the affected
   * relation name.
   */
  readonly onRequiredRelationClick?: RelationConflictAlertProps["onRequiredRelationClick"];
}

const CONTINUOUS_CREATE_KEY = "contentgrid-continuous-create";

function readInitialContinuousCreate(): boolean {
  return (
    typeof window !== "undefined" && window.sessionStorage.getItem(CONTINUOUS_CREATE_KEY) === "true"
  );
}

/**
 * Smart component: gates on `profile.createTemplate`, runs `useCreateEntityItem`, and maps
 * server validation errors into server-sourced `FieldValidationError[]` via the `hal-forms`
 * feature. Renders `CreateEntityItemForm` (the `<form>`/chrome-only component) once a create
 * template is available. Rendered by `CreateEntityItemView`, the package's public entry point
 * for both apps' route files.
 */
export function CreateEntityItemContainer(props: Readonly<CreateEntityItemContainerProps>) {
  const createTemplate = props.profile.createTemplate;

  if (!createTemplate) {
    return (
      <ProblemAlert
        model={toProblemDisplayModel(
          `Creating a new ${props.profile.singularName} is not permitted.`,
        )}
      />
    );
  }

  return <CreateEntityItemContainerReady {...props} createTemplate={createTemplate} />;
}

function CreateEntityItemContainerReady({
  profile,
  createTemplate,
  onCreated,
  onCancel,
  onDirtyChange,
  onRelationItemClick,
  onRelationItemCreateNew,
  onConflictingItemClick,
  onMissingRelationTargetClick,
  onAllowedValuesClick,
  onExpectedTypeClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<CreateEntityItemContainerProps & { createTemplate: CreateHalFormTemplate }>) {
  const { fields, layout } = useMemo(() => resolveHalFormsFields(createTemplate), [createTemplate]);
  const [externalErrors, setExternalErrors] = useState<Record<string, FieldValidationError[]>>({});
  const fileFields = useMemo(() => fields.filter((field) => field.kind === "file"), [fields]);
  // The file attached on the Create Item page goes into the first file field, read once on
  // mount. Without a file field it is kept for a later create form.
  const fileFieldName = fileFields[0]?.name;
  // The file field shown in the preview: the first one, until the user picks a file in another.
  const [previewFieldName, setPreviewFieldName] = useState(fileFieldName);
  // The preview dialog, opened from a file field's preview button on narrow screens.
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const isNarrow = !useMediaQuery(SPLIT_BREAKPOINT_QUERY);
  // The dialog only exists on narrow screens. Widening the window closes it, so narrowing it again
  // doesn't reopen a dialog the user never asked for.
  if (!isNarrow && isPreviewOpen) setIsPreviewOpen(false);
  const [initialValues] = useState(() => {
    const { initialFile } = useCreateEntityItemState.getState();
    return initialFile && fileFieldName ? { [fileFieldName]: initialFile } : undefined;
  });
  const formState = useHalFormsFieldState({ fields, initialValues, externalErrors });
  const { setValue } = formState;
  // Removing the file from the file field also drops the attached file from the store, so it
  // isn't offered again on the next create form. This runs on user edits only, not on a value
  // effect: the form's own reset after a create clears the field without going through here.
  const handleFieldChange = useCallback(
    (name: string, value: FieldValue) => {
      if (name === fileFieldName && !value)
        useCreateEntityItemState.getState().setInitialFile(null);
      if (value instanceof File) setPreviewFieldName(name);
      setValue(name, value);
    },
    [fileFieldName, setValue],
  );
  const [continuousCreateMode, setContinuousCreateModeState] = useState<boolean>(
    readInitialContinuousCreate,
  );
  // Bumped once per continuous-create reset, never on initial mount — see
  // create-entity-item-form.tsx, which refocuses the first field only when this changes.
  const [formResetCount, setFormResetCount] = useState(0);

  useEffect(() => {
    onDirtyChange?.(formState.isDirty);
  }, [formState.isDirty, onDirtyChange]);

  const createMutation = useCreateEntityItem(profile);

  function setContinuousCreateMode(value: boolean) {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(CONTINUOUS_CREATE_KEY, String(value));
    }
    setContinuousCreateModeState(value);
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setExternalErrors({});
    // Clears a previous failed attempt's alert immediately, before client-side validation runs.
    // Without this, a submit blocked by validate() (e.g. a required field newly left empty)
    // returns early without ever calling the mutation again, so createMutation.isError/error
    // would otherwise still be "true"/stale from the LAST server round-trip — showing an old
    // server error alongside the new, unrelated client-side validation errors.
    createMutation.reset();
    if (!formState.validate()) return;

    const values = formState.buildValues(createTemplate.template);
    createMutation.mutate(values, {
      onSuccess: (item) => {
        toast.success(
          `${capitalizeFirstLetter(profile.singularName)} has been successfully created!`,
          // In continuous-create mode the form stays put instead of following `onCreated` (see
          // below) — this action is the only way to reach the item that toast is about, without
          // waiting to finish the whole create session first.
          onCreated ? { action: { label: "View", onClick: () => onCreated(item) } } : undefined,
        );
        // The just-submitted values are now safely saved — nothing about them is
        // "unsaved" anymore, so isDirty (and onDirtyChange) must reflect that even if
        // the caller doesn't navigate away immediately (e.g. an embedding that stays
        // mounted after create instead of redirecting).
        useCreateEntityItemState.getState().setInitialFile(null);
        // Reset to an empty baseline, not the values this form was opened with — the initial
        // file it may have been prefilled with was just used.
        formState.reset({});
        setPreviewFieldName(fileFieldName);
        if (continuousCreateMode) {
          setFormResetCount((count) => count + 1);
        } else {
          onCreated?.(item);
        }
      },
      onError: (error) => {
        setExternalErrors(toServerFieldErrors(getValidationFieldErrors(error)));
      },
    });
  }

  // A validation problem shows on its fields; every other error goes in the alert.
  const formAlertError =
    createMutation.error && !isValidationProblem(createMutation.error)
      ? toProblemDisplayModel(createMutation.error)
      : undefined;

  // Focusing a file field shows it in the preview beside the form.
  const handleFieldFocus = useCallback(
    (name: string) => {
      if (fileFields.some((field) => field.name === name)) setPreviewFieldName(name);
    },
    [fileFields],
  );

  const handleFilePreview = useCallback((name: string) => {
    setPreviewFieldName(name);
    setIsPreviewOpen(true);
  }, []);

  // Narrow screens open the preview in a dialog from a file field's "Preview file" button. Wide
  // screens show it beside the form, highlighting the field it shows unless that is the only file
  // field, with nothing to tell apart.
  let filePreview: HalFormsFilePreview | undefined;
  if (previewFieldName && isNarrow) {
    filePreview = { placement: "dialog", onOpen: handleFilePreview };
  } else if (previewFieldName) {
    filePreview = {
      placement: "beside",
      previewedFieldName: fileFields.length > 1 ? previewFieldName : undefined,
    };
  }

  const form = (
    <CreateEntityItemForm
      fields={fields}
      layout={layout}
      values={formState.values}
      fieldState={formState.fieldState}
      onFieldChange={handleFieldChange}
      onFieldBlur={formState.touchField}
      onRelationItemClick={onRelationItemClick}
      onRelationItemCreateNew={onRelationItemCreateNew}
      onFieldFocus={handleFieldFocus}
      filePreview={filePreview}
      onSubmit={handleSubmit}
      isSubmitting={createMutation.isPending}
      onCancel={onCancel}
      continuousCreate={continuousCreateMode}
      onContinuousCreateChange={setContinuousCreateMode}
      formResetCount={formResetCount}
      nonFieldErrorAlert={
        formAlertError && (
          <ProblemAlert
            model={formAlertError}
            onConflictingItemClick={onConflictingItemClick}
            onMissingRelationTargetClick={onMissingRelationTargetClick}
            onAllowedValuesClick={onAllowedValuesClick}
            onExpectedTypeClick={onExpectedTypeClick}
            onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
            onRequiredRelationClick={onRequiredRelationClick}
          />
        )
      }
    />
  );

  if (!previewFieldName) return form;

  const previewField = fileFields.find((field) => field.name === previewFieldName);
  const previewFile = formState.values[previewFieldName];
  // Only one of the dialog and the side panel is mounted, so the file is read and the PDF engine
  // started once.
  const preview = (
    <CreateEntityItemFilePreview
      fileFields={fileFields}
      fieldName={previewFieldName}
      onFieldNameChange={setPreviewFieldName}
      file={previewFile instanceof File ? previewFile : undefined}
      onFileChange={
        previewField?.readOnly
          ? undefined
          : (file) => handleFieldChange(previewFieldName, file ?? undefined)
      }
    />
  );

  return (
    <div className="flex gap-6 split:min-h-0 split:flex-1">
      <div className="min-w-0 flex-[2] split:flex split:max-w-2xl split:flex-col">{form}</div>
      {isNarrow ? (
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="flex h-[80vh] flex-col gap-0 p-0 sm:max-w-3xl">
            <DialogHeader className="border-b p-4">
              <DialogTitle>Preview file</DialogTitle>
              <DialogDescription className="sr-only">
                The file picked in the form, before it is saved.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1">{preview}</div>
          </DialogContent>
        </Dialog>
      ) : (
        <aside
          aria-label="File preview"
          className="min-w-0 flex-[3] overflow-hidden rounded-md border"
        >
          {preview}
        </aside>
      )}
    </div>
  );
}
