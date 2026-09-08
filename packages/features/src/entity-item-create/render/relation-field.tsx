import { type ReactNode, useMemo, useState } from "react";
import {
  type FieldValue,
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItemCollection,
} from "@contentgrid/navigator-data";
import {
  type EntityPickerOption,
  type RelationColumn,
  RelationToManyRenderer,
  RelationToOneRenderer,
} from "@contentgrid/ui";
import { ProblemAlert } from "../../problem-details";
import type { FieldDescriptor } from "../model/field-descriptor";

export type RelationFieldDescriptor = Extract<FieldDescriptor, { kind: "relation" }>;

/** Matches the same "preview a handful of attributes" convention already used for a
 * linked item elsewhere in this codebase (e.g. `RelationToOneSection`, `RelationItemSearchDialog`). */
const RELATION_PREVIEW_ATTRIBUTE_COUNT = 4;

/** First few user-defined attributes of the target profile, for previewing a linked item. */
function relationPreviewColumns(targetProfile: ProfileEntity): RelationColumn[] {
  return targetProfile.userDefinedAttributes
    .slice(0, RELATION_PREVIEW_ATTRIBUTE_COUNT)
    .map((attr) => ({ key: attr.name, title: attr.title ?? attr.name }));
}

export interface RelationFieldProps {
  readonly field: RelationFieldDescriptor;
  readonly targetProfile: ProfileEntity;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  /**
   * href -> raw attribute data, for the picker's linked-item preview (`RelationSection`'s
   * `RelationItem.data`) — deliberately NOT `Record<string, EntityItem>`: what's cached here is a
   * plain snapshot of a few preview attributes read straight off `EntityPickerOption.data`
   * (`item.halItem.data`), not a full `EntityItem` accessor with its own links/ETag/mutation
   * methods. Every entry is either freshly resolved by this same create session's own picker
   * fetch (see `onItemResolved` below) or never touched at all, so a stale/dangling entry can't
   * accumulate here the way it could on a long-lived edit form.
   */
  readonly relationItemsData: Readonly<Record<string, Record<string, unknown>>>;
  readonly onItemResolved: (href: string, data: Record<string, unknown>) => void;
  readonly renderCreateRelationTarget?: (targetProfile: ProfileEntity) => ReactNode;
  /**
   * Fired when the user wants to open a linked item's own detail page — receives the target
   * entity's profile and the item's real `id` (never the href; see `resolvedIds` below). All
   * navigation is left to the caller, matching the existing `RelationItemClickHandler` convention
   * used by the entity-item detail page's own relation sections
   * (`packages/features/src/entity-item/relations/relation-shared.tsx`). Omitted entirely (no
   * "view details" affordance) when not provided.
   */
  readonly onViewRelationItem?: (targetProfile: ProfileEntity, itemId: string) => void;
}

/**
 * One instance per relation field — needed so `useEntityItemCollection` (a hook) can be called
 * unconditionally per field, matching the existing one-component-per-relation shape used by the
 * detail-page relation sections. This is the ADR-004 "relation `FieldRenderer` may fetch"
 * exception in the new architecture: it lives in `packages/features` (not `packages/ui`, which
 * cannot fetch) and is invoked from `../render/field-renderer.tsx`'s `case "relation"`.
 *
 * Fetches the target collection directly rather than through a wrapper hook — pagination only,
 * for now: `searchQuery`/`onSearch` are local UI state the picker needs but nothing filters on
 * yet, matching the ACC-3128 review call to leave search out of this pass and wire it in later.
 *
 * Direct port of the retired `packages/features/src/entity-item-create/relation-field.tsx`,
 * adapted to the merged `relation` `FieldDescriptor` kind (`cardinality` replaces the old
 * `relation-to-one`/`relation-to-many` type split) — the `sharedProps` construction below is
 * unchanged from that file.
 */
export function RelationField({
  field,
  targetProfile,
  value,
  onChange,
  error,
  relationItemsData,
  onItemResolved,
  renderCreateRelationTarget,
  onViewRelationItem,
}: Readonly<RelationFieldProps>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pageUrl, setPageUrl] = useState<string | undefined>(undefined);
  // href -> real entity id, for `onViewRelationItem` only — `onItemResolved`'s own (href, data)
  // signature stays unchanged for the container's cache, so this is purely local/additive.
  const [resolvedIds, setResolvedIds] = useState<Record<string, string>>({});

  const collection = useEntityItemCollection(
    pageUrl ? { url: pageUrl, profileEntity: targetProfile } : { profileEntity: targetProfile },
  );

  const options: EntityPickerOption[] = (collection.data?.items ?? []).map((item) => ({
    id: item.id,
    href: item.selfLink.href,
    data: item.halItem.data,
  }));
  const columns = useMemo(() => relationPreviewColumns(targetProfile), [targetProfile]);

  function handleItemResolved(href: string, data: Record<string, unknown>) {
    const id = options.find((option) => option.href === href)?.id;
    if (id) setResolvedIds((prev) => ({ ...prev, [href]: id }));
    onItemResolved(href, data);
  }

  const onViewItem = onViewRelationItem
    ? (href: string) => {
        const id = resolvedIds[href];
        if (id) onViewRelationItem(targetProfile, id);
      }
    : undefined;

  const sharedProps = {
    name: field.name,
    label: field.label,
    required: field.required,
    readOnly: field.readOnly,
    options,
    isLoading: collection.isPending,
    searchQuery,
    onSearch: setSearchQuery,
    hasPreviousPage: collection.data?.hasPrevious ?? false,
    hasNextPage: collection.data?.hasNext ?? false,
    onPreviousPage: () => {
      if (collection.data?.prevHref) setPageUrl(collection.data.prevHref);
    },
    onNextPage: () => {
      if (collection.data?.nextHref) setPageUrl(collection.data.nextHref);
    },
    selectedItemsData: relationItemsData,
    columns,
    onItemResolved: handleItemResolved,
    createNewLink: renderCreateRelationTarget?.(targetProfile),
    onViewItem,
  };

  return (
    <>
      {collection.isError && <ProblemAlert model={toProblemDisplayModel(collection.error)} />}
      {field.cardinality === "to-one" ? (
        <RelationToOneRenderer value={value} onChange={onChange} error={error} {...sharedProps} />
      ) : (
        <RelationToManyRenderer value={value} onChange={onChange} error={error} {...sharedProps} />
      )}
    </>
  );
}
