import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  type CreateHalFormTemplate,
  type EntityItem,
  type FieldValue,
  type ProfileEntity,
  type RenderFieldDescriptor,
  createFormToRenderFields,
  getValidationFieldErrors,
  toProblemDisplayModel,
  useCreateEntityItem,
  useFormFields,
  useProfileEntities,
  useRelationTargetSearch,
} from "@contentgrid/navigator-data";
import {
  Button,
  type EntityPickerOption,
  FieldRenderer,
  type RelationColumn,
  RelationToManyRenderer,
  RelationToOneRenderer,
  Skeleton,
} from "@contentgrid/ui";
import { ProblemAlert } from "../problem-details";

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
      <p className="text-sm text-muted-foreground">
        Creating a new {props.profile.singularName} is not permitted.
      </p>
    );
  }

  return <CreateEntityItemFormFields {...props} createTemplate={createTemplate} />;
}

type RelationRenderFieldDescriptor = Extract<
  RenderFieldDescriptor,
  { type: "relation-to-one" | "relation-to-many" }
>;

function isRelationField(field: RenderFieldDescriptor): field is RelationRenderFieldDescriptor {
  return field.type === "relation-to-one" || field.type === "relation-to-many";
}

/** Matches the same "preview a handful of attributes" convention already used for a
 * linked item elsewhere in this codebase (e.g. `RelationToOneSection`, `RelationItemSearchDialog`). */
const RELATION_PREVIEW_ATTRIBUTE_COUNT = 4;

/** First few user-defined attributes of the target profile, for previewing a linked item. */
function relationPreviewColumns(targetProfile: ProfileEntity): RelationColumn[] {
  return targetProfile.userDefinedAttributes
    .slice(0, RELATION_PREVIEW_ATTRIBUTE_COUNT)
    .map((attr) => ({ key: attr.name, title: attr.title ?? attr.name }));
}

/**
 * One instance per relation field — needed so `useRelationTargetSearch` (a
 * hook) can be called unconditionally per field, matching the existing
 * one-component-per-relation shape used by the detail-page relation sections.
 */
function RelationField({
  field,
  targetProfile,
  value,
  onChange,
  error,
  relationItemsData,
  onItemResolved,
  renderCreateRelationTarget,
}: Readonly<{
  field: RelationRenderFieldDescriptor;
  targetProfile: ProfileEntity;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  error?: string;
  relationItemsData: Readonly<Record<string, Record<string, unknown>>>;
  onItemResolved: (href: string, data: Record<string, unknown>) => void;
  renderCreateRelationTarget?: (targetProfile: ProfileEntity) => ReactNode;
}>) {
  const search = useRelationTargetSearch({ targetProfile });
  const options: EntityPickerOption[] = search.items.map((item) => ({
    id: item.id,
    href: item.selfLink.href,
    data: item.halItem.data,
  }));
  const columns = useMemo(() => relationPreviewColumns(targetProfile), [targetProfile]);

  const sharedProps = {
    options,
    isLoading: search.isLoading,
    searchQuery: search.searchQuery,
    onSearch: search.setSearchQuery,
    hasPreviousPage: search.hasPreviousPage,
    hasNextPage: search.hasNextPage,
    onPreviousPage: search.goToPreviousPage,
    onNextPage: search.goToNextPage,
    selectedItemsData: relationItemsData,
    columns,
    onItemResolved,
    createNewLink: renderCreateRelationTarget?.(targetProfile),
  };

  return field.type === "relation-to-one" ? (
    <RelationToOneRenderer
      field={field}
      value={value}
      onChange={onChange}
      error={error}
      {...sharedProps}
    />
  ) : (
    <RelationToManyRenderer
      field={field}
      value={value}
      onChange={onChange}
      error={error}
      {...sharedProps}
    />
  );
}

function CreateEntityItemFormFields({
  profile,
  createTemplate,
  onCreated,
  onCancel,
  renderCreateRelationTarget,
  onDirtyChange,
}: Readonly<CreateEntityItemFormProps & { createTemplate: CreateHalFormTemplate }>) {
  const fields = useMemo(() => createFormToRenderFields(createTemplate), [createTemplate]);
  const hasRelationFields = useMemo(() => fields.some(isRelationField), [fields]);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const formFields = useFormFields({ fields, serverErrors });

  useEffect(() => {
    onDirtyChange?.(formFields.isDirty);
  }, [formFields.isDirty, onDirtyChange]);

  // Not useLoadedProfileEntities() — its isLoading is "every result is still
  // pending", which flips false as soon as ONE profile settles (e.g. one
  // already cached from elsewhere) even while others are still loading,
  // making the "target not found" fallback below fire on a profile that
  // simply hasn't resolved yet.
  //
  // Disabled via queryOptionsOverride (never by skipping the hook call, per
  // navigator-data/CLAUDE.md) when this form has no relation field — fetching
  // every entity profile in the application is otherwise wasted work.
  const profileResults = useProfileEntities({
    queryOptionsOverride: { enabled: hasRelationFields },
  });
  const profiles = useMemo(
    () => profileResults.flatMap((r) => (r.data ? [r.data] : [])),
    [profileResults],
  );
  // profileResults is [] both before the profile-root query resolves (entity
  // links not yet derived) and when disabled above — neither is "settled",
  // so an empty array must not vacuously satisfy .every().
  const profilesSettled = profileResults.length > 0 && profileResults.every((r) => !r.isPending);
  const [relationItemsData, setRelationItemsData] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const onItemResolved = useCallback(
    (href: string, data: Record<string, unknown>) =>
      setRelationItemsData((prev) => ({ ...prev, [href]: data })),
    [],
  );

  const createMutation = useCreateEntityItem(profile);

  function handleSubmit(event: FormEvent) {
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

        if (!profilesSettled) {
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

      {nonFieldError && <ProblemAlert model={toProblemDisplayModel(nonFieldError)} />}

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
