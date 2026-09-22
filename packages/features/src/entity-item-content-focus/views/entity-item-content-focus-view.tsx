import { type ReactNode, useEffect, useState } from "react";
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
  /**
   * Fired when the user clicks the default breadcrumb trail's "Home" crumb. The view itself
   * has no route knowledge (Principle VIII) — omit this to render that crumb as plain,
   * non-interactive text instead of a dead link.
   */
  readonly onHomeClick?: () => void;
  /**
   * Fired when the user clicks the default breadcrumb trail's collection crumb, with the
   * profile entity's name. Omit this to render that crumb as plain, non-interactive text
   * instead of a dead link.
   */
  readonly onCollectionClick?: (entityName: string) => void;
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
  onHomeClick,
  onCollectionClick,
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

  // Home -> collection -> item id: the view derives the LABELS from the profile/item it already
  // resolved (Principle VIII), but has no route knowledge of its own — clicking a crumb fires a
  // plain callback (`onHomeClick`/`onCollectionClick`) supplied by the host app, which owns the
  // actual routing. A crumb with no callback renders as plain, non-interactive text rather than
  // a dead link. A host overrides the whole trail via `toolbar` when it needs different chrome.
  const interactiveCrumbClassName =
    "text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer";
  const staticCrumbClassName = "text-sm text-muted-foreground";
  const defaultBreadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {onHomeClick ? (
            <button type="button" onClick={onHomeClick} className={interactiveCrumbClassName}>
              Home
            </button>
          ) : (
            <span className={staticCrumbClassName}>Home</span>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {onCollectionClick ? (
            <button
              type="button"
              onClick={() => onCollectionClick(profileEntity.name)}
              className={interactiveCrumbClassName}
            >
              {profileEntity.pluralName}
            </button>
          ) : (
            <span className={staticCrumbClassName}>{profileEntity.pluralName}</span>
          )}
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

  // When the content-focus body is what renders (profileEntity.hasContentAttributes), the
  // preview panel should run edge to edge rather than sit inside the standard page gutters —
  // drop horizontal padding only, keeping the vertical rhythm. The EntityItemView fallback body
  // keeps the standard padding on both axes.
  const contentPadding = profileEntity.hasContentAttributes ? "vertical" : true;

  if (resolvedToolbar === false) {
    return <PageLayout padded={contentPadding}>{content}</PageLayout>;
  }
  return (
    <BreadCrumbsToolBarLayout
      breadcrumbs={resolvedToolbar.breadcrumbs}
      actions={resolvedToolbar.actions}
      contentPadded={contentPadding}
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
