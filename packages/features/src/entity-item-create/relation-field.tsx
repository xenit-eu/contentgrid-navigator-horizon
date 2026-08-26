import { type ReactNode, useMemo, useState } from "react";
import {
  type FieldValue,
  type ProfileEntity,
  type RenderFieldDescriptor,
  toProblemDisplayModel,
  useEntityItemCollection,
} from "@contentgrid/navigator-data";
import {
  type EntityPickerOption,
  type RelationColumn,
  RelationToManyRenderer,
  RelationToOneRenderer,
} from "@contentgrid/ui";
import { ProblemAlert } from "../problem-details";

export type RelationRenderFieldDescriptor = Extract<
  RenderFieldDescriptor,
  { type: "relation-to-one" | "relation-to-many" }
>;

export function isRelationField(
  field: RenderFieldDescriptor,
): field is RelationRenderFieldDescriptor {
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

export interface RelationFieldProps {
  readonly field: RelationRenderFieldDescriptor;
  readonly targetProfile: ProfileEntity;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  readonly relationItemsData: Readonly<Record<string, Record<string, unknown>>>;
  readonly onItemResolved: (href: string, data: Record<string, unknown>) => void;
  readonly renderCreateRelationTarget?: (targetProfile: ProfileEntity) => ReactNode;
}

/**
 * One instance per relation field — needed so `useEntityItemCollection` (a hook) can be called
 * unconditionally per field, matching the existing one-component-per-relation shape used by the
 * detail-page relation sections.
 *
 * Fetches the target collection directly rather than through a wrapper hook — pagination only,
 * for now: `searchQuery`/`onSearch` are local UI state the picker needs but nothing filters on
 * yet, matching the ACC-3128 review call to leave search out of this pass and wire it in later.
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
}: Readonly<RelationFieldProps>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pageUrl, setPageUrl] = useState<string | undefined>(undefined);

  const collection = useEntityItemCollection(
    pageUrl ? { url: pageUrl, profileEntity: targetProfile } : { profileEntity: targetProfile },
  );

  const options: EntityPickerOption[] = (collection.data?.items ?? []).map((item) => ({
    id: item.id,
    href: item.selfLink.href,
    data: item.halItem.data,
  }));
  const columns = useMemo(() => relationPreviewColumns(targetProfile), [targetProfile]);

  const sharedProps = {
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
    onItemResolved,
    createNewLink: renderCreateRelationTarget?.(targetProfile),
  };

  return (
    <>
      {field.type === "relation-to-one" ? (
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
      )}
      {collection.isError && <ProblemAlert model={toProblemDisplayModel(collection.error)} />}
    </>
  );
}
