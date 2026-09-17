import { type ReactNode, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  type EntityItem,
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItem,
  useLoadedProfileEntities,
  useProfileEntity,
} from "@contentgrid/navigator-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Separator,
} from "@contentgrid/ui";
import { ErrorPage, LoadingPage } from "../../app-info-pages";
import {
  EntityItemAttributes,
  EntityItemView,
  type EntityItemViewProps,
  RelationToManySection,
  RelationToOneSection,
} from "../../entity-item";
import { BreadCrumbsToolBarLayout, PageLayout } from "../../layout";
import { ContentAttributeSelector } from "../components/content-attribute-selector";
import { ContentFocusLayout } from "../components/content-focus-layout";
import { ContentPreviewPanel } from "../components/content-preview-panel";
import { selectDefaultContentAttribute } from "../util/select-default-content-attribute";

/**
 * Local stand-in for spec-001's shared `ViewToolbarConfiguration`/`ViewToolbarOptions`
 * (`specs/001-feature-view-architecture/contracts/feature-view.md`, branch `ACC-3184-spec-001`
 * — not yet merged into this branch). Same shape, scoped to this feature only; replace with the
 * shared type once that branch lands rather than growing a second toolbar-configuration type.
 */
export interface ViewToolbarOptions {
  readonly breadcrumbs?: ReactNode;
  readonly actions?: ReactNode;
}
export type ViewToolbarConfiguration = ViewToolbarOptions | false | undefined;

export interface EntityItemContentFocusViewProps extends Pick<
  EntityItemViewProps,
  "onMissingRelationTargetClick" | "onBlindRelationOverwriteClick" | "onRequiredRelationClick"
> {
  /** Profile entity name from the route. */
  readonly entityName: string;
  readonly itemId: string;
  /** `undefined`/`{}` uses every default; `false` renders content with no toolbar chrome. */
  readonly toolbar?: ViewToolbarConfiguration;
  /** Fired when the user clicks through to a related entity item, from either a to-one or
   * to-many relation section in the side panel. */
  readonly onRelationItemClick?: (target: { entityName: string; itemId: string }) => void;
}

function resolveToolbar(
  toolbar: ViewToolbarConfiguration,
  defaultBreadcrumbs: ReactNode,
): ViewToolbarOptions | false {
  if (toolbar === false) return false;
  return {
    breadcrumbs: toolbar?.breadcrumbs ?? defaultBreadcrumbs,
    actions: toolbar?.actions,
  };
}

/**
 * App-agnostic content-focus item detail view (spec `002-pdf-viewer`, contract
 * `contracts/content-focus-view.md`): resolves `entityName`/`itemId` into a `profileEntity` +
 * `EntityItem` itself — the host supplies only primitives and callbacks (Principle VIII). FR-001:
 * an entity with no content attributes falls back to the existing (stable) `EntityItemView` body;
 * one that has them renders the PDF/content preview beside the item's attributes and relations.
 */
export function EntityItemContentFocusView(props: Readonly<EntityItemContentFocusViewProps>) {
  const { entityName } = props;
  const profileQuery = useProfileEntity({ name: entityName });

  // The app's `/$entity` route gate (`EntityProfileGate`) guarantees the profile is already
  // resolved and cached before this view mounts — this is a defensive fallback for the (expected
  // to be unreachable in practice) case of this view being rendered without that gate, not a
  // second full-page loading gate of its own (data-loading.md: "does not add a second whole-page
  // gate").
  if (!profileQuery.data) {
    return <LoadingPage />;
  }

  return <EntityItemContentFocusViewBody {...props} profileEntity={profileQuery.data} />;
}

function EntityItemContentFocusViewBody({
  profileEntity,
  itemId,
  toolbar,
  onRelationItemClick,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<EntityItemContentFocusViewProps & { profileEntity: ProfileEntity }>) {
  const item = useEntityItem({ profileEntity, entityId: itemId });
  const { profiles: loadedProfiles } = useLoadedProfileEntities();

  // `undefined` means "use the data-model default" (selectDefaultContentAttribute); reset
  // whenever the item identity changes so an explicit choice for one item never leaks into the
  // next (FR-006).
  const [userSelectedAttribute, setUserSelectedAttribute] = useState<string | undefined>(undefined);
  useEffect(() => {
    setUserSelectedAttribute(undefined);
  }, [itemId]);

  const defaultAttribute = item.data
    ? selectDefaultContentAttribute(profileEntity, item.data)
    : undefined;
  const selectedAttribute = userSelectedAttribute ?? defaultAttribute;

  function handleRelationItemClick(relatedEntityName: string, relatedItemId: string): void {
    onRelationItemClick?.({ entityName: relatedEntityName, itemId: relatedItemId });
  }

  // Home -> collection -> item id, matching what apps/navigator-experimental's route built
  // itself before this view existed (Principle VIII: the view derives its own default
  // breadcrumbs from the profile/item it already resolved; a host overrides via `toolbar` only
  // when it needs different chrome). `Link`'s `to`/`params`/`search` are cast past this
  // package's generic (app-agnostic) route typing — the same pattern already used in
  // `layout/sidebar-entity-nav.tsx` for the identical reason.
  const linkClassName =
    "text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer";
  const defaultBreadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <Link to={"/" as string} search={{} as Record<string, never>} className={linkClassName}>
            Home
          </Link>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <Link
            to={"/$entity" as string}
            params={{ entity: profileEntity.name } as Record<string, string>}
            search={{} as Record<string, never>}
            className={linkClassName}
          >
            {profileEntity.pluralName}
          </Link>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{itemId}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
  const resolvedToolbar = resolveToolbar(toolbar, defaultBreadcrumbs);

  const content = (
    <>
      {item.isPending && <LoadingPage />}
      {item.isError && <ErrorPage model={toProblemDisplayModel(item.error)} />}
      {item.isSuccess &&
        (profileEntity.hasContentAttributes ? (
          <ContentFocusEntityItemBody
            entityItem={item.data}
            attributeName={selectedAttribute}
            onSelectAttribute={setUserSelectedAttribute}
            loadedProfiles={loadedProfiles}
            onRelationItemClick={handleRelationItemClick}
            onMissingRelationTargetClick={onMissingRelationTargetClick}
            onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
            onRequiredRelationClick={onRequiredRelationClick}
          />
        ) : (
          <EntityItemView
            profile={profileEntity}
            itemId={itemId}
            toolbar={false}
            onRelationItemClick={handleRelationItemClick}
            onMissingRelationTargetClick={onMissingRelationTargetClick}
            onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
            onRequiredRelationClick={onRequiredRelationClick}
          />
        ))}
    </>
  );

  if (resolvedToolbar === false) {
    return <PageLayout>{content}</PageLayout>;
  }
  return (
    <BreadCrumbsToolBarLayout
      breadcrumbs={resolvedToolbar.breadcrumbs}
      actions={resolvedToolbar.actions}
    >
      {content}
    </BreadCrumbsToolBarLayout>
  );
}

function ContentFocusEntityItemBody({
  entityItem,
  attributeName,
  onSelectAttribute,
  loadedProfiles,
  onRelationItemClick,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<{
  entityItem: EntityItem;
  /** `undefined` only when the profile's content-attribute list is somehow empty despite
   * `hasContentAttributes` being true — defensive; should not occur in practice. */
  attributeName: string | undefined;
  onSelectAttribute: (attributeName: string) => void;
  loadedProfiles: readonly ProfileEntity[];
  /** Adapter already bound to the object-shaped `onRelationItemClick` prop on the outer view —
   * `RelationToOneSection`/`RelationToManySection` (from the stable `entity-item` feature) still
   * expect the two-positional-argument `RelationItemClickHandler` shape. */
  onRelationItemClick: (relatedEntityName: string, relatedItemId: string) => void;
}> &
  Pick<
    EntityItemContentFocusViewProps,
    "onMissingRelationTargetClick" | "onBlindRelationOverwriteClick" | "onRequiredRelationClick"
  >) {
  if (attributeName === undefined) {
    return null;
  }

  return (
    <ContentFocusLayout
      sidePanelTitle="Details"
      preview={
        <ContentPreviewPanel
          entityItem={entityItem}
          attributeName={attributeName}
          toolbarStart={
            <ContentAttributeSelector
              entityItem={entityItem}
              value={attributeName}
              onChange={onSelectAttribute}
            />
          }
        />
      }
      sidePanel={
        <div className="space-y-6">
          <EntityItemAttributes item={entityItem} />
          {(entityItem.toOneRelations.length > 0 || entityItem.toManyRelations.length > 0) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Relations</h2>
                {entityItem.toOneRelations.map((relation) => (
                  <RelationToOneSection
                    key={relation.name}
                    relation={relation}
                    profiles={loadedProfiles}
                    onItemClick={onRelationItemClick}
                    onMissingRelationTargetClick={onMissingRelationTargetClick}
                    onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
                  />
                ))}
                {entityItem.toManyRelations.map((relation) => (
                  <RelationToManySection
                    key={relation.name}
                    relation={relation}
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
      }
    />
  );
}
