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
import { ErrorPage, LoadingPage } from "../../../../app-info-pages";
import { BreadCrumbsToolBarLayout, PageLayout } from "../../../../layout";
import { EntityItemAttributes } from "../../../attributes/entity-item-attributes";
import { EntityItemView, type EntityItemViewProps } from "../../../entity-item-view";
import { RelationToManySection } from "../../../relations/relation-to-many-section";
import { RelationToOneSection } from "../../../relations/relation-to-one-section";
import { EntityItemReference } from "../../entity-item-reference";
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
   * Renders the default breadcrumb trail's "Home" crumb as a real link, given the label to show.
   * Same composition pattern as `TabbedLayout`'s `renderTabLink`
   * (`packages/ui/src/patterns/tabbed-layout.tsx`): wrap `label` in a `BreadcrumbLink asChild`
   * around the host's own router `Link` (e.g. TanStack Router) — this package has no router
   * dependency (Principle VIII), so navigation stays the host's responsibility. Omit this to
   * render that crumb as plain, non-interactive text instead of a dead `<button>`.
   */
  readonly renderHomeLink?: (label: ReactNode) => ReactNode;
  /**
   * Renders the default breadcrumb trail's collection crumb as a real link, given the profile
   * entity's routing name and the label to show. Same composition pattern as `renderHomeLink`.
   * Omit this to render that crumb as plain, non-interactive text instead of a dead `<button>`.
   */
  readonly renderCollectionLink?: (entityName: string, label: ReactNode) => ReactNode;
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
  renderHomeLink,
  renderCollectionLink,
}: Readonly<EntityItemContentFocusViewProps & { profileEntity: ProfileEntity }>) {
  const item = useEntityItem({ profileEntity, entityId: itemId });
  const { profiles: loadedProfiles } = useLoadedProfileEntities();

  // `undefined` means "use the data-model default" (selectDefaultContentAttribute); reset
  // whenever the item identity changes — entity OR id, not just id (navigating e.g.
  // /document/1 -> /invoice/1 keeps the same itemId with a different profileEntity) — so an
  // explicit choice for one item never leaks into the next (FR-006).
  const [userSelectedAttribute, setUserSelectedAttribute] = useState<string | undefined>(undefined);
  useEffect(() => {
    setUserSelectedAttribute(undefined);
  }, [profileEntity.name, itemId]);

  // Defense in depth alongside the effect above: the effect only clears state AFTER the render
  // that already switched to the new profileEntity/itemId commits, so a stale
  // `userSelectedAttribute` from the previous entity can otherwise still reach
  // `useContentPreview` for one render — which throws synchronously (not just renders an error
  // state) for an attribute name that isn't a content attribute of the *current* item
  // (`use-content-preview.ts`'s `findContentAttribute`). Validating here means that render uses
  // the fresh default instead of crashing.
  const currentContentAttributeNames = new Set(
    profileEntity.userDefinedAttributes.filter((attr) => attr.isContent).map((attr) => attr.name),
  );
  const validUserSelectedAttribute =
    userSelectedAttribute !== undefined && currentContentAttributeNames.has(userSelectedAttribute)
      ? userSelectedAttribute
      : undefined;

  const defaultAttribute = item.data
    ? selectDefaultContentAttribute(profileEntity, item.data)
    : undefined;
  const selectedAttribute = validUserSelectedAttribute ?? defaultAttribute;

  function handleRelationItemClick(relatedEntityName: string, relatedItemId: string): void {
    onRelationItemClick?.({ entityName: relatedEntityName, itemId: relatedItemId });
  }

  // Home -> collection -> item id: the view derives the LABELS from the profile/item it already
  // resolved (Principle VIII), but has no route knowledge of its own — a crumb is rendered by the
  // host-supplied `renderHomeLink`/`renderCollectionLink` (real router links; same composition
  // pattern as `TabbedLayout`'s `renderTabLink`), falling back to plain, non-interactive text
  // when the host omits it rather than a dead `<button>`. A host overrides the whole trail via
  // `toolbar` when it needs different chrome.
  const staticCrumbClassName = "text-sm text-muted-foreground";
  const defaultBreadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {renderHomeLink ? (
            renderHomeLink("Home")
          ) : (
            <span className={staticCrumbClassName}>Home</span>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {renderCollectionLink ? (
            renderCollectionLink(profileEntity.name, profileEntity.pluralName)
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
  // drop the horizontal padding, and the top vertical padding too (the toolbar strip above
  // already has its own bottom padding, so a top gutter here would just double that gap) —
  // keeping only the bottom gutter for breathing room at the end of the scroll region. The
  // EntityItemView fallback body keeps the standard padding on both axes.
  const contentPadding = profileEntity.hasContentAttributes ? "bottom" : true;

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
      // Round-2 review: show which item this panel belongs to (icon, name, subtitle) instead of
      // a generic "Details" label — same reference row `EntityItemView`'s own attribute-focus
      // body already shows above its attributes/relations (`entity-item-view.tsx`). `sm` to fit
      // the panel's compact header bar; `sidePanelTitle` above still supplies the accessible name
      // for the collapse/expand button.
      sidePanelHeader={<EntityItemReference item={entityItem} size="sm" />}
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
