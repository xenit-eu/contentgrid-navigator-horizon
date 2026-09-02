import { type ReactNode, type SubmitEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  type CreateHalFormTemplate,
  type EntityItem,
  type ProfileEntity,
  createFormToRenderFields,
  getValidationFieldErrors,
  toProblemDisplayModel,
  useCreateEntityItem,
  useFormFields,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import { Button, FieldRenderer, Skeleton } from "@contentgrid/ui";
import {
  ProblemAlert,
  type RelationConflictAlertProps,
  type ValidationAlertProps,
} from "../problem-details";
import { RelationField, isRelationField } from "./relation-field";

export interface CreateEntityItemFormProps {
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
 * Renders a create form for `profile` from its create-form template:
 * attribute fields, plus relation-to-one/relation-to-many fields once their
 * target profile resolves. `file` fields are covered by another ticket;
 * `FieldRenderer` shows them as a not-yet-supported placeholder rather than
 * dropping or crashing on them.
 */
export function CreateEntityItemForm(props: Readonly<CreateEntityItemFormProps>) {
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

  return <CreateEntityItemFormFields {...props} createTemplate={createTemplate} />;
}

function CreateEntityItemFormFields({
  profile,
  createTemplate,
  onCreated,
  onCancel,
  renderCreateRelationTarget,
  onDirtyChange,
  onConflictingItemClick,
  onMissingRelationTargetClick,
  onAllowedValuesClick,
  onExpectedTypeClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<CreateEntityItemFormProps & { createTemplate: CreateHalFormTemplate }>) {
  const fields = useMemo(() => createFormToRenderFields(createTemplate), [createTemplate]);
  const hasRelationFields = useMemo(() => fields.some(isRelationField), [fields]);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const formFields = useFormFields({ fields, serverErrors });

  useEffect(() => {
    onDirtyChange?.(formFields.isDirty);
  }, [formFields.isDirty, onDirtyChange]);

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

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setServerErrors({});
    if (!formFields.validate()) return;

    const values = formFields.buildValues(createTemplate.template);
    createMutation.mutate(values, {
      onSuccess: (item) => {
        // The just-submitted values are now safely saved — nothing about them is
        // "unsaved" anymore, so isDirty (and onDirtyChange) must reflect that even if
        // the caller doesn't navigate away immediately (e.g. an embedding that stays
        // mounted after create instead of redirecting).
        formFields.reset();
        onCreated?.(item);
      },
      onError: (error) => {
        const fieldErrors = getValidationFieldErrors(error);
        setServerErrors(
          Object.fromEntries(
            fieldErrors
              .filter((fieldError) => fieldError.field !== undefined)
              .map((fieldError) => [
                fieldError.field as string,
                fieldError.detail ?? fieldError.title,
              ]),
          ),
        );
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

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {nonFieldError && (
        <ProblemAlert
          model={toProblemDisplayModel(nonFieldError)}
          onConflictingItemClick={onConflictingItemClick}
          onMissingRelationTargetClick={onMissingRelationTargetClick}
          onAllowedValuesClick={onAllowedValuesClick}
          onExpectedTypeClick={onExpectedTypeClick}
          onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
          onRequiredRelationClick={onRequiredRelationClick}
        />
      )}

      {fields.map((field) => {
        if (!isRelationField(field)) {
          return (
            <FieldRenderer
              key={field.name}
              field={field}
              value={formFields.values[field.name]}
              onChange={(value) => formFields.setValue(field.name, value)}
              error={formFields.errors[field.name]}
            />
          );
        }

        if (profilesLoading) {
          return <Skeleton key={field.name} className="h-16 w-full rounded-md" />;
        }

        const targetProfile = field.profileRelation?.getTargetProfile(profiles);
        if (!targetProfile) {
          return (
            <p key={field.name} className="text-sm text-muted-foreground">
              {field.label}: related entity profile unavailable for linking.
            </p>
          );
        }

        return (
          <RelationField
            key={field.name}
            field={field}
            targetProfile={targetProfile}
            value={formFields.values[field.name]}
            onChange={(value) => formFields.setValue(field.name, value)}
            error={formFields.errors[field.name]}
            relationItemsData={relationItemsData}
            onItemResolved={onItemResolved}
            renderCreateRelationTarget={renderCreateRelationTarget}
          />
        );
      })}

      <div className="flex gap-2">
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating…" : "Create"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
