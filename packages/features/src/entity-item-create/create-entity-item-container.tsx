import { type ReactNode, type SubmitEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  type CreateHalFormTemplate,
  type EntityItem,
  type ProfileEntity,
  getValidationFieldErrors,
  toProblemDisplayModel,
  useCreateEntityItem,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import {
  ProblemAlert,
  type RelationConflictAlertProps,
  type ValidationAlertProps,
} from "../problem-details";
import { CreateEntityItemForm } from "./create-entity-item-form";
import { resolveCreateFieldDescriptors } from "./model/resolve-create-field-descriptors";
import type { FieldAnnotation, RelationFieldData } from "./render/field-renderer";
import type { FieldError } from "./state/field-error";
import { toFieldErrors } from "./state/to-field-errors";
import { useEntityFormState } from "./state/use-entity-form-state";

export interface CreateEntityItemContainerProps {
  readonly profile: ProfileEntity;
  /** Fired after the item is created; typically used to navigate to the new item. */
  readonly onCreated?: (item: EntityItem) => void;
  /** Renders a cancel button next to submit when provided. */
  readonly onCancel?: () => void;
  /**
   * Renders a "create new" affordance inside a relation field's picker for
   * the given target profile — e.g. a link to that profile's own create
   * route, opened in a new tab. Omitted entirely when not provided.
   */
  readonly renderCreateRelationTarget?: (targetProfile: ProfileEntity) => ReactNode;
  /**
   * Fired when the user wants to open a linked relation item's own detail page — receives the
   * target entity's profile and the item's real id. All navigation is left to the caller (this
   * form has no router knowledge of its own — see `renderCreateRelationTarget` above for the same
   * pattern). Omitted entirely (no "view details" affordance in the relation field) when not
   * provided.
   */
  readonly onViewRelationItem?: (targetProfile: ProfileEntity, itemId: string) => void;
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
  /**
   * Per-field extraction data, keyed by field name — how an externally-extracted value (from
   * the PDF content uploaded during create) gets offered back into a field. See
   * `render/field-renderer.tsx`'s `FieldAnnotation` doc comment.
   */
  readonly annotations?: Readonly<Record<string, FieldAnnotation>>;
}

/**
 * Smart component: gates on `profile.createTemplate`, loads relation profiles + the
 * `relationItemsData` cache, runs `useCreateEntityItem`, and maps server validation errors into
 * external `FieldError[]`. Renders `CreateEntityItemForm` (the `<form>`/chrome-only component)
 * once a create template is available.
 *
 * Direct replacement for the "gating + state + mutation" half of the retired, monolithic
 * `create-entity-item-form.tsx` (formerly `CreateEntityItemForm` + its inner
 * `CreateEntityItemFormFields`). `CreateEntityItemView`/the package barrel re-export this under
 * the previous public name (`CreateEntityItemForm`) so both apps' route files need zero changes.
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
  renderCreateRelationTarget,
  onViewRelationItem,
  onDirtyChange,
  onConflictingItemClick,
  onMissingRelationTargetClick,
  onAllowedValuesClick,
  onExpectedTypeClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
  annotations,
}: Readonly<CreateEntityItemContainerProps & { createTemplate: CreateHalFormTemplate }>) {
  const { fields } = useMemo(() => resolveCreateFieldDescriptors(createTemplate), [createTemplate]);
  const hasRelationFields = useMemo(
    () => fields.some((field) => field.kind === "relation"),
    [fields],
  );
  const [externalErrors, setExternalErrors] = useState<Record<string, FieldError[]>>({});
  const formState = useEntityFormState({ fields, externalErrors });

  useEffect(() => {
    onDirtyChange?.(formState.isDirty);
  }, [formState.isDirty, onDirtyChange]);

  // Disabled via queryOptionsOverride (never by skipping the hook call, per
  // navigator-data/CLAUDE.md) when this form has no relation field — fetching
  // every entity profile in the application is otherwise wasted work.
  const { profiles, isLoading: profilesLoading } = useLoadedProfileEntities({
    queryOptionsOverride: { enabled: hasRelationFields },
  });
  const [relationItemsData, setRelationItemsData] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const onItemResolved = useCallback(
    (href: string, data: Record<string, unknown>) =>
      setRelationItemsData((prev) => ({ ...prev, [href]: data })),
    [],
  );

  const createMutation = useCreateEntityItem(profile);

  // Only defined when there's at least one annotation to apply — lets `annotations` fields
  // update (and dismiss their errors) in a single commit via `formState.setValues`, rather than
  // requiring one `onFieldChange` call per field the way each field's own "Use extracted value"
  // button (built by `create-entity-item-form.tsx` from the same `annotations`) already does.
  const onApplyAllAnnotations =
    annotations && Object.keys(annotations).length > 0
      ? () =>
          formState.setValues(
            Object.fromEntries(
              Object.entries(annotations).map(([name, annotation]) => [
                name,
                annotation.extractedValue,
              ]),
            ),
          )
      : undefined;

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setExternalErrors({});
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
  const submitFieldErrors = createMutation.isError
    ? getValidationFieldErrors(createMutation.error)
    : [];
  const nonFieldError =
    createMutation.isError &&
    (submitFieldErrors.length === 0 ||
      submitFieldErrors.some((fieldError) => fieldError.field === undefined))
      ? createMutation.error
      : undefined;

  const relationFieldData: RelationFieldData | undefined = hasRelationFields
    ? {
        resolveTargetProfile: (field) =>
          profilesLoading
            ? undefined
            : profiles.find((candidate) => candidate.collectionUrl === field.targetHref),
        relationItemsData,
        onItemResolved,
        renderCreateRelationTarget,
        onViewRelationItem,
      }
    : undefined;

  return (
    <CreateEntityItemForm
      createTemplate={createTemplate}
      values={formState.values}
      fieldState={formState.fieldState}
      onFieldChange={formState.setValue}
      onFieldBlur={formState.touchField}
      onSubmit={handleSubmit}
      isSubmitting={createMutation.isPending}
      onCancel={onCancel}
      relationFieldData={relationFieldData}
      annotations={annotations}
      onApplyAllAnnotations={onApplyAllAnnotations}
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
