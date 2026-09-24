import { useState } from "react";
import { EyeIcon, LinkBreakIcon } from "@phosphor-icons/react";
import {
  type EntityItem,
  type FieldValue,
  type ProfileEntity,
  useEntityItemsByUrl,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import {
  Alert,
  AlertActionSection,
  AlertButton,
  AlertTitle,
  RecordRowAction,
  RelationToManyRenderer,
  RelationToOneRenderer,
  Skeleton,
} from "@contentgrid/ui";
import {
  EntityItemReference,
  type RelationItemClickHandler,
  type RelationItemCreateHandler,
  RelationItemSearchDialog,
} from "../../entity-item";
import { EntityItemCollectionTable } from "../../entity-item-collection";
import type { FieldDescriptor } from "../model/field-descriptor";

type RelationFieldDescriptor = Extract<FieldDescriptor, { kind: "relation" }>;

/**
 * Linked items are fetched only to display them: once cached they're never refetched (legacy
 * `AddRelationField`'s options), and a failed item isn't retried since a retry won't bring it back.
 */
const LINKED_ITEM_QUERY_OPTIONS = {
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  retry: false,
} as const;

export interface RelationFieldProps {
  readonly field: RelationFieldDescriptor;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly onBlur?: () => void;
  readonly error?: string;
  readonly onRelationItemClick?: RelationItemClickHandler;
  readonly onRelationItemCreateNew?: RelationItemCreateHandler;
}

type ResolvedRelationFieldProps = Omit<RelationFieldProps, "onBlur"> & {
  readonly targetProfile: ProfileEntity;
};

/**
 * A create-form relation field (legacy `AddRelationField`): resolves the target profile from the
 * property's `options.link` and renders the to-one or to-many variant.
 */
export function RelationField({ onBlur, ...props }: Readonly<RelationFieldProps>) {
  const { field, onChange } = props;
  const { profiles, isLoading } = useLoadedProfileEntities();
  // Legacy `AddRelationField`: the profile that describes the property's remote options link.
  const { options } = field.property;
  const targetLink = options?.isRemote() ? options.link : undefined;
  const targetProfile = targetLink && profiles.find((profile) => profile.describes(targetLink));

  // A picker link/unlink is the relation field's equivalent of leaving an input: mark it touched.
  const handleChange = (next: FieldValue) => {
    onChange(next);
    onBlur?.();
  };

  if (!targetProfile) {
    // Profiles still loading; once loaded, a target that no profile describes can't be linked.
    return isLoading ? <Skeleton className="h-12 w-full rounded-md" /> : null;
  }

  return field.multiValue ? (
    <RelationToManyField {...props} onChange={handleChange} targetProfile={targetProfile} />
  ) : (
    <RelationToOneField {...props} onChange={handleChange} targetProfile={targetProfile} />
  );
}

/** Legacy `AddRelationField`'s alert for a linked item that failed to load. */
function LinkedItemErrorAlert({
  error,
  onRemove,
}: Readonly<{ error: Error; onRemove?: () => void }>) {
  return (
    <Alert tone="error">
      <AlertTitle>Invalid item detected. error: {error.message || "no details."}</AlertTitle>
      {onRemove && (
        <AlertActionSection>
          <AlertButton onClick={onRemove}>Remove</AlertButton>
        </AlertActionSection>
      )}
    </Alert>
  );
}

function RelationToOneField({
  field,
  value,
  onChange,
  error,
  targetProfile,
  onRelationItemClick,
  onRelationItemCreateNew,
}: Readonly<ResolvedRelationFieldProps>) {
  const href = typeof value === "string" ? value : "";
  const [pickerOpen, setPickerOpen] = useState(false);
  const { collection, failed } = useEntityItemsByUrl({
    urls: href ? [href] : [],
    profileEntity: targetProfile,
    queryOptionsOverride: LINKED_ITEM_QUERY_OPTIONS,
  });
  const linkedItem = collection.items[0];

  return (
    <>
      {failed.map(({ url, error: fetchError }) => (
        <LinkedItemErrorAlert
          key={url}
          error={fetchError}
          onRemove={field.readOnly ? undefined : () => onChange("")}
        />
      ))}
      <RelationToOneRenderer
        name={field.name}
        label={field.label}
        required={field.required}
        readOnly={field.readOnly}
        description={field.description}
        value={value}
        onChange={onChange}
        error={error}
        linkedItem={linkedItem && <EntityItemReference item={linkedItem} />}
        onViewDetails={
          linkedItem && onRelationItemClick
            ? () => onRelationItemClick(targetProfile.name, linkedItem.id)
            : undefined
        }
        isLoading={!!href && !linkedItem && failed.length === 0}
        onLink={() => setPickerOpen(true)}
      />
      <RelationItemSearchDialog
        targetProfile={targetProfile}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple={false}
        onSelect={(item) => {
          onChange(item.selfLink.href);
          setPickerOpen(false);
        }}
        onCreateNew={onRelationItemCreateNew}
      />
    </>
  );
}

/**
 * Shows the linked items in the shared `EntityItemCollectionTable`. Items picked in the link
 * dialog are added to them, skipping any already linked (as on the details page).
 */
function RelationToManyField({
  field,
  value,
  onChange,
  error,
  targetProfile,
  onRelationItemClick,
  onRelationItemCreateNew,
}: Readonly<ResolvedRelationFieldProps>) {
  const hrefs = Array.isArray(value)
    ? value.filter((href): href is string => typeof href === "string")
    : [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const { collection, failed } = useEntityItemsByUrl({
    urls: hrefs,
    profileEntity: targetProfile,
    queryOptionsOverride: LINKED_ITEM_QUERY_OPTIONS,
  });

  const remove = (href: string) => onChange(hrefs.filter((h) => h !== href));
  const viewItem = onRelationItemClick
    ? (item: EntityItem) => onRelationItemClick(targetProfile.name, item.id)
    : undefined;

  return (
    <>
      {failed.map(({ url, error: fetchError }) => (
        <LinkedItemErrorAlert
          key={url}
          error={fetchError}
          onRemove={field.readOnly ? undefined : () => remove(url)}
        />
      ))}
      <RelationToManyRenderer
        name={field.name}
        label={field.label}
        required={field.required}
        readOnly={field.readOnly}
        description={field.description}
        error={error}
        count={collection.items.length}
        onLink={() => setPickerOpen(true)}
        onClear={() => onChange([])}
      >
        {collection.isEmpty ? (
          <p className="text-sm text-muted-foreground">No related item selected</p>
        ) : (
          <EntityItemCollectionTable
            profile={targetProfile}
            collection={collection}
            paginated={false}
            showRowActions={!field.readOnly || !!viewItem}
            renderRowActions={(item) => (
              <>
                {viewItem && (
                  <RecordRowAction
                    label="Details"
                    icon={<EyeIcon className="size-4" aria-hidden />}
                    onClick={() => viewItem(item)}
                  />
                )}
                {!field.readOnly && (
                  <RecordRowAction
                    label="Remove from selection"
                    icon={<LinkBreakIcon className="size-4" aria-hidden />}
                    onClick={() => remove(item.selfLink.href)}
                  />
                )}
              </>
            )}
          />
        )}
      </RelationToManyRenderer>
      <RelationItemSearchDialog
        targetProfile={targetProfile}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple
        onLinkSelected={(items) => {
          const newHrefs = items
            .map((item) => item.selfLink.href)
            .filter((href) => !hrefs.includes(href));
          onChange([...hrefs, ...newHrefs]);
          setPickerOpen(false);
        }}
        onCreateNew={onRelationItemCreateNew}
      />
    </>
  );
}
