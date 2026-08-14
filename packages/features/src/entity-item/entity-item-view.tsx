import type { ReactNode } from "react";
import {
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItem,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import { PageTitle, Separator } from "@contentgrid/ui";
import { ErrorPage, LoadingPage } from "../app-info-pages";
import { BreadCrumbsToolBarLayout, PageLayout } from "../layout";
import { EntityItemAttributes } from "./attributes/entity-item-attributes";
import type {
  MutationErrorDisplayProps,
  RelationItemClickHandler,
} from "./relations/relation-shared";
import { RelationToManySection } from "./relations/relation-to-many-section";
import { RelationToOneSection } from "./relations/relation-to-one-section";

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
  Pick<
    MutationErrorDisplayProps,
    "onMissingRelationTargetClick" | "onBlindRelationOverwriteClick" | "onRequiredRelationClick"
  > & {
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
    onMissingRelationTargetClick,
    onBlindRelationOverwriteClick,
    onRequiredRelationClick,
  } = props;

  const item = useEntityItem(
    "url" in props ? { url: props.url } : { profileEntity: props.profile, entityId: props.itemId },
  );
  const { profiles: loadedProfiles } = useLoadedProfileEntities();

  // In url mode the profile/id aren't known until the item resolves —
  // `item.data.profileEntity` is the source of truth either way once loaded.
  const displayItemId = "itemId" in props ? props.itemId : (item.data?.id ?? "…");
  const displayEntityLabel =
    "profile" in props ? props.profile.pluralName : (item.data?.profileEntity.pluralName ?? "…");

  const content = (
    <>
      <div className="p-4">
        <PageTitle header="Entity Detail" title={displayItemId} subtitle={displayEntityLabel} />
      </div>

      {item.isPending && <LoadingPage />}

      {item.isError && <ErrorPage model={toProblemDisplayModel(item.error)} />}

      {item.isSuccess && (
        <div className="space-y-6 p-4 pt-0">
          <EntityItemAttributes profile={item.data.profileEntity} item={item.data} />

          {(item.data.toOneRelations.length > 0 || item.data.toManyRelations.length > 0) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Relations</h2>
                {item.data.toOneRelations.map((rel) => (
                  <RelationToOneSection
                    key={rel.name}
                    relation={rel}
                    profiles={loadedProfiles}
                    onItemClick={onRelationItemClick}
                    onMissingRelationTargetClick={onMissingRelationTargetClick}
                    onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
                  />
                ))}
                {item.data.toManyRelations.map((rel) => (
                  <RelationToManySection
                    key={rel.name}
                    relation={rel}
                    profiles={loadedProfiles}
                    onItemClick={onRelationItemClick}
                    onMissingRelationTargetClick={onMissingRelationTargetClick}
                    onRequiredRelationClick={onRequiredRelationClick}
                    onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
                  />
                ))}
              </div>
            </>
          )}
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
