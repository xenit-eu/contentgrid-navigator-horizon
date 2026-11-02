import type { ReactNode } from "react";
import {
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItem,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import { ErrorPage, LoadingPage } from "../app-info-pages";
import { BreadCrumbsToolBarLayout, PageLayout } from "../layout";
import { EditableEntityItemAttributes } from "./attributes/editable-entity-item-attributes";
import { EditEntityItemButton } from "./edit/edit-entity-item-button";
import { useEditContext } from "./edit/use-edit-context";
import { EntityItemRelations } from "./relations/entity-item-relations";
import type {
  RelationItemClickHandler,
  RelationItemCreateHandler,
  RelationProblemHandlers,
} from "./relations/relation-handlers";
import {
  EntityItemReference,
  EntityItemReferenceLoading,
} from "./variations/entity-item-reference";

/** Identify the item by its already-known profile and id. */
export interface EntityItemViewByProfile {
  readonly profile: ProfileEntity;
  readonly itemId: string;
}

/**
 * Identify the item by its URL alone. The describing `ProfileEntity` is
 * discovered by checking every loaded profile's `describes` link template
 * against the URL (`useEntityItem`'s discover-by-url mode) — never by
 * parsing the id or entity name out of the URL string. Use this when the
 * caller only has a link (e.g. from a search result or another entity's
 * relation) and doesn't already know which entity type it points to.
 */
export interface EntityItemViewByUrl {
  readonly url: string;
}

export type EntityItemIdentity = EntityItemViewByProfile | EntityItemViewByUrl;

export type EntityItemViewProps = EntityItemIdentity &
  RelationProblemHandlers & {
    /**
     * Render the breadcrumb toolbar on top; otherwise the content is wrapped
     * in a plain {@link PageLayout}. Defaults to `false`.
     */
    readonly toolbar?: boolean;
    /** Breadcrumb trail shown in the toolbar (only used when `toolbar` is true). */
    readonly breadcrumbs?: ReactNode;
    /** Actions / buttons shown at the end of the toolbar (only when `toolbar` is true). */
    readonly actions?: ReactNode;
    /**
     * Fired when the user clicks through to a related entity item, from
     * either a to-one or to-many relation section; receives the target
     * entity's profile name and the item's id.
     */
    readonly onRelationItemClick?: RelationItemClickHandler;
    /** Fired from a relation picker's "Create" button with the target entity's profile name. */
    readonly onRelationItemCreateNew?: RelationItemCreateHandler;
  };

/**
 * App-agnostic item detail view: fetches a single entity item — either from
 * an already-known `profile` + `itemId`, or discovered from a bare `url` —
 * and renders its attributes and relations, optionally inside a breadcrumb
 * toolbar. All routing / navigation is supplied by the caller through
 * `onRelationItemClick` and `breadcrumbs` — this component performs no
 * navigation itself.
 */
export function EntityItemView(props: Readonly<EntityItemViewProps>) {
  const {
    toolbar = false,
    breadcrumbs,
    actions,
    onRelationItemClick,
    onRelationItemCreateNew,
    onMissingRelationTargetClick,
    onBlindRelationOverwriteClick,
    onRequiredRelationClick,
  } = props;

  const item = useEntityItem(
    "url" in props ? { url: props.url } : { profileEntity: props.profile, entityId: props.itemId },
  );
  const { profiles: loadedProfiles } = useLoadedProfileEntities();
  const editContext = useEditContext(item.data, item.refetch);

  const content = (
    <>
      <div className="flex items-center justify-between gap-2 p-4">
        {item.data ? (
          <>
            <EntityItemReference item={item.data} size="lg" />
            <EditEntityItemButton
              item={item.data}
              isEditing={editContext.isEditing}
              onEdit={() => editContext.setIsEditing(true)}
            />
          </>
        ) : (
          <EntityItemReferenceLoading size="lg" />
        )}
      </div>

      {item.isPending && <LoadingPage />}

      {/* A failed background refetch keeps the loaded item (and an open edit form) on screen. */}
      {item.isError && !item.data && <ErrorPage model={toProblemDisplayModel(item.error)} />}

      {item.data && (
        <div className="space-y-6 p-4 pt-0">
          <EditableEntityItemAttributes
            item={editContext.editedItem ?? item.data}
            isEditing={editContext.isEditing}
            onEditingChange={editContext.setIsEditing}
            onRefresh={() => void editContext.refresh()}
          />

          <EntityItemRelations
            item={item.data}
            profiles={loadedProfiles}
            onItemClick={onRelationItemClick}
            onCreateNew={onRelationItemCreateNew}
            onMissingRelationTargetClick={onMissingRelationTargetClick}
            onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
            onRequiredRelationClick={onRequiredRelationClick}
          />
        </div>
      )}
    </>
  );

  if (toolbar) {
    return (
      <BreadCrumbsToolBarLayout breadcrumbs={breadcrumbs} actions={actions}>
        {content}
      </BreadCrumbsToolBarLayout>
    );
  }
  return <PageLayout>{content}</PageLayout>;
}
