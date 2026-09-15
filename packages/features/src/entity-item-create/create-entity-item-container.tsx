import { type SubmitEvent, useEffect, useMemo, useState } from "react";
import {
  type CreateHalFormTemplate,
  type EntityItem,
  type ProfileEntity,
  getValidationFieldErrors,
  toProblemDisplayModel,
  useCreateEntityItem,
} from "@contentgrid/navigator-data";
import {
  ProblemAlert,
  type RelationConflictAlertProps,
  type ValidationAlertProps,
} from "../problem-details";
import { CreateEntityItemForm } from "./create-entity-item-form";
import { resolveCreateFieldDescriptors } from "./model/resolve-create-field-descriptors";
import type { FieldError } from "./state/field-error";
import { toFieldErrors } from "./state/to-field-errors";
import { useEntityItemCreateFormState } from "./state/use-entity-item-create-form-state";

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

/**
 * Smart component: gates on `profile.createTemplate`, runs `useCreateEntityItem`, and maps
 * server validation errors into external `FieldError[]`. Renders `CreateEntityItemForm` (the
 * `<form>`/chrome-only component) once a create template is available. Rendered by
 * `CreateEntityItemView`, the package's public entry point for both apps' route files.
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
  onConflictingItemClick,
  onMissingRelationTargetClick,
  onAllowedValuesClick,
  onExpectedTypeClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<CreateEntityItemContainerProps & { createTemplate: CreateHalFormTemplate }>) {
  const { fields, layout } = useMemo(
    () => resolveCreateFieldDescriptors(createTemplate),
    [createTemplate],
  );
  const [externalErrors, setExternalErrors] = useState<Record<string, FieldError[]>>({});
  const formState = useEntityItemCreateFormState({ fields, externalErrors });

  useEffect(() => {
    onDirtyChange?.(formState.isDirty);
  }, [formState.isDirty, onDirtyChange]);

  const createMutation = useCreateEntityItem(profile);

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
        // The just-submitted values are now safely saved — nothing about them is
        // "unsaved" anymore, so isDirty (and onDirtyChange) must reflect that even if
        // the caller doesn't navigate away immediately (e.g. an embedding that stays
        // mounted after create instead of redirecting).
        formState.reset();
        onCreated?.(item);
      },
      onError: (error) => {
        setExternalErrors(toFieldErrors(getValidationFieldErrors(error)));
      },
    });
  }

  // A validation problem can contain entity-level errors with no `field` (e.g. a
  // cross-field constraint) alongside, or instead of, field-scoped ones. Those never
  // render inline, so they must always fall through to the alert below — checking only
  // "no field errors at all" left them silently dropped whenever the array was non-empty
  // but contained an entry with no `field`.
  //
  // The same reasoning extends to a field-scoped error whose `field` doesn't match any
  // rendered field name (e.g. a system/audit field, or any property this attributes-only
  // form doesn't produce a descriptor for) — `toFieldErrors` buckets it under that field
  // name, but no `FieldRenderer` exists to show it, and it also isn't a `field === undefined`
  // entry, so without this check it would be dropped by both paths and never reach the user.
  const knownFieldNames = new Set(fields.map((field) => field.name));
  const submitFieldErrors = createMutation.isError
    ? getValidationFieldErrors(createMutation.error)
    : [];
  const nonFieldError =
    createMutation.isError &&
    (submitFieldErrors.length === 0 ||
      submitFieldErrors.some(
        (fieldError) => fieldError.field === undefined || !knownFieldNames.has(fieldError.field),
      ))
      ? createMutation.error
      : undefined;

  return (
    <CreateEntityItemForm
      fields={fields}
      layout={layout}
      values={formState.values}
      fieldState={formState.fieldState}
      onFieldChange={formState.setValue}
      onFieldBlur={formState.touchField}
      onSubmit={handleSubmit}
      isSubmitting={createMutation.isPending}
      onCancel={onCancel}
      nonFieldErrorAlert={
        nonFieldError && (
          <ProblemAlert
            model={toProblemDisplayModel(nonFieldError)}
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
}
