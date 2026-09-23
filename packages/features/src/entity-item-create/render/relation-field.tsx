import { useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  EntityItem,
  type FieldValue,
  type ProfileEntity,
  useEntityItem,
  useNavigatorData,
  useProfileEntities,
} from "@contentgrid/navigator-data";
import { type DataTableRow, RelationToManyRenderer, RelationToOneRenderer } from "@contentgrid/ui";
import {
  EntityItemReference,
  type RelationItemCreateHandler,
  RelationItemSearchDialog,
  resolveNewlyLinkedHrefs,
} from "../../entity-item";
import { buildColumns, buildRows, useColumnVisibility } from "../../preferences";
import type { FieldDescriptor } from "../model/field-descriptor";

type RelationFieldDescriptor = Extract<FieldDescriptor, { kind: "relation" }>;

/**
 * Seeds `EntityItem.fetchByUrlQuery`'s cache entry with an item the picker already fetched, so
 * linking it doesn't immediately trigger a redundant refetch of data already in hand — the same
 * reason `RelationToManyField`'s `rows` shows a "Loading…" placeholder for a href with no cache
 * entry yet at all. Mirrors legacy Navigator's `AddRelationField.handleRelationChange`, which
 * does the same `queryClient.setQueryData` before updating form state.
 */
function seedLinkedItemCache(
  queryClient: ReturnType<typeof useQueryClient>,
  apiFetch: Parameters<typeof EntityItem.fetchByUrlQuery>[0],
  targetProfile: ProfileEntity,
  item: EntityItem,
) {
  queryClient.setQueryData(
    EntityItem.fetchByUrlQuery(apiFetch, item.selfLink.href, targetProfile).queryKey,
    item,
  );
}

export interface RelationFieldProps {
  readonly field: RelationFieldDescriptor;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  /** See `RelationItemSearchDialog`'s `onCreateNew` doc comment. */
  readonly onCreateNew?: RelationItemCreateHandler;
}

/**
 * Dispatches a "relation" `FieldDescriptor` to `RelationToOneRenderer`/`RelationToManyRenderer`
 * (by `field.multiValue`) and owns everything those `packages/ui` renderers stay deliberately
 * agnostic of: resolving the target profile, fetching a display summary for each linked href,
 * and opening the shared `RelationItemSearchDialog` picker (reused as-is from the entity-item
 * feature's edit-form relation sections, so create and edit share one picker implementation).
 */
export function RelationField({
  field,
  value,
  onChange,
  error,
  onCreateNew,
}: Readonly<RelationFieldProps>) {
  const profiles = useProfileEntities()
    .map((result) => result.data)
    .filter((profile): profile is ProfileEntity => !!profile);
  const targetProfile = field.profileRelation?.getTargetProfile(profiles);

  return field.multiValue ? (
    <RelationToManyField
      field={field}
      value={value}
      onChange={onChange}
      error={error}
      targetProfile={targetProfile}
      onCreateNew={onCreateNew}
    />
  ) : (
    <RelationToOneField
      field={field}
      value={value}
      onChange={onChange}
      error={error}
      targetProfile={targetProfile}
      onCreateNew={onCreateNew}
    />
  );
}

function RelationToOneField({
  field,
  value,
  onChange,
  error,
  targetProfile,
  onCreateNew,
}: Readonly<RelationFieldProps & { targetProfile: ProfileEntity | undefined }>) {
  const href = typeof value === "string" ? value : "";
  const linkedItem = useEntityItem({ url: href });
  const [pickerOpen, setPickerOpen] = useState(false);
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();

  return (
    <>
      <RelationToOneRenderer
        name={field.name}
        label={field.label}
        required={field.required}
        readOnly={field.readOnly}
        description={field.description}
        value={value}
        onChange={onChange}
        error={error}
        linkedItem={linkedItem.data && <EntityItemReference item={linkedItem.data} />}
        isLoading={!!href && linkedItem.isPending}
        onLink={targetProfile ? () => setPickerOpen(true) : undefined}
      />
      {targetProfile && (
        <RelationItemSearchDialog
          targetProfile={targetProfile}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(item) => {
            seedLinkedItemCache(queryClient, apiFetch, targetProfile, item);
            onChange(item.selfLink.href);
          }}
          onCreateNew={onCreateNew}
        />
      )}
    </>
  );
}

/**
 * Builds `columns`/`rows` for `RelationToManyRenderer`'s `DataTable` exactly the way
 * `relation-to-many-section.tsx` (the edit-view's equivalent relation table) does via the same
 * `buildColumns`/`buildRows` helpers — the create-form table and the edit-view table read off
 * the same target-profile columns, matching legacy Navigator's `CollectionSearchTable` being the
 * literal same component in both places. The one deliberate difference: each row's `id` is set
 * to the linked item's href (not `item.id`) — see `RelationToManyRendererProps`'s doc comment for
 * why (there's no server-side relation link to unlink yet, only local pending form state).
 */
function RelationToManyField({
  field,
  value,
  onChange,
  error,
  targetProfile,
  onCreateNew,
}: Readonly<RelationFieldProps & { targetProfile: ProfileEntity | undefined }>) {
  const hrefs = Array.isArray(value) ? (value as string[]) : [];
  const { apiFetch } = useNavigatorData();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const visibility = useColumnVisibility(targetProfile);
  const columns = useMemo(
    () => (targetProfile ? buildColumns(targetProfile, visibility) : [{ key: "id", header: "ID" }]),
    [targetProfile, visibility],
  );

  const itemQueries = useQueries({
    queries: targetProfile
      ? hrefs.map((href) => EntityItem.fetchByUrlQuery(apiFetch, href, targetProfile))
      : [],
  });

  // Every href gets a row immediately, even before its query resolves — otherwise a newly-linked
  // item (whose fetch is still pending on this first render) would be left out of `rows`
  // entirely, making the table fall back to its "No items linked" empty state right after a
  // successful link. Errored hrefs (e.g. the linked item was deleted server-side) get the same
  // placeholder-row treatment — first column only, every other cell blank — so the link stays
  // visible and Unlink stays reachable instead of the broken reference silently vanishing.
  const rows = useMemo(() => {
    return hrefs.map((href, index): DataTableRow => {
      const query = itemQueries[index];
      if (query?.data) {
        const [row] = buildRows([query.data], columns);
        return { ...row!, id: href };
      }
      const placeholder = query?.isError ? "Unavailable" : "Loading…";
      return {
        id: href,
        data: Object.fromEntries(
          columns.map((col, colIndex) => [col.key, colIndex === 0 ? placeholder : undefined]),
        ),
      };
    });
  }, [hrefs, itemQueries, columns]);

  return (
    <>
      <RelationToManyRenderer
        name={field.name}
        label={field.label}
        required={field.required}
        readOnly={field.readOnly}
        description={field.description}
        error={error}
        entityName={targetProfile?.name ?? field.name}
        entityTitle={targetProfile?.pluralName ?? field.label}
        columns={columns}
        rows={rows}
        onUnlink={(href) => onChange(hrefs.filter((h) => h !== href))}
        onLinkMore={targetProfile ? () => setPickerOpen(true) : undefined}
        onUnlinkAll={() => onChange([])}
      />
      {targetProfile && (
        <RelationItemSearchDialog
          targetProfile={targetProfile}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onLinkSelected={(items) => {
            const newHrefs = resolveNewlyLinkedHrefs(items, new Set(hrefs));
            if (newHrefs.length === 0) return;
            if (targetProfile) {
              const newHrefSet = new Set(newHrefs);
              items
                .filter((item) => newHrefSet.has(item.selfLink.href))
                .forEach((item) => seedLinkedItemCache(queryClient, apiFetch, targetProfile, item));
            }
            onChange([...hrefs, ...newHrefs]);
          }}
          onCreateNew={onCreateNew}
        />
      )}
    </>
  );
}
