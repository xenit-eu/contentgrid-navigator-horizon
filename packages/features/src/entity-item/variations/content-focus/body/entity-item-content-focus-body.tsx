import { useEffect, useState } from "react";
import {
  type EntityItem,
  type ProfileEntity,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import { Separator } from "@contentgrid/ui";
import { RightSidePanelLayout } from "../../../../layout";
import { EditableEntityItemAttributes } from "../../../attributes/editable-entity-item-attributes";
import { EditEntityItemButton } from "../../../edit/edit-entity-item-button";
import { type EditContextRefetch, noRefetch, useEditContext } from "../../../edit/use-edit-context";
import { EntityItemDetail } from "../../../entity-item-detail";
import type {
  RelationItemCreateHandler,
  RelationProblemHandlers,
} from "../../../relations/relation-handlers";
import { RelationToManySection } from "../../../relations/relation-to-many-section";
import { RelationToOneSection } from "../../../relations/relation-to-one-section";
import { EntityItemReference } from "../../entity-item-reference";
import { ContentAttributeSelector } from "../components/content-attribute-selector";
import { ContentPreviewPanel } from "../components/content-preview-panel";
import { selectDefaultContentAttribute } from "../util/select-default-content-attribute";

/**
 * Content padding for whatever wraps {@link EntityItemContentFocusBody}. When the content-focus
 * body is what renders (`profileEntity.hasContentAttributes`), the preview panel should run edge
 * to edge rather than sit inside the standard page gutters — drop the horizontal padding, and the
 * top vertical padding too (the toolbar strip above already has its own bottom padding, so a top
 * gutter here would just double that gap) — keeping only the bottom gutter for breathing room at
 * the end of the scroll region. The `EntityItemDetail` fallback body keeps the standard padding on
 * both axes.
 */
export function entityItemContentFocusPadding(profileEntity: ProfileEntity): true | "bottom" {
  return profileEntity.hasContentAttributes ? "bottom" : true;
}

export type EntityItemContentFocusBodyProps = RelationProblemHandlers & {
  /** The already-loaded item; its profile is `entityItem.profileEntity`. */
  readonly entityItem: EntityItem;
  /** Fired when the user clicks through to a related entity item, from either a to-one or
   * to-many relation section in the side panel. */
  readonly onRelationItemClick?: (target: { entityName: string; itemId: string }) => void;
  /** Fired from a relation picker's "Create" button with the target entity's profile name. */
  readonly onRelationItemCreateNew?: RelationItemCreateHandler;
  /**
   * Reloads the item; the view that owns the item query supplies it. After a version conflict the
   * edit form's Refresh calls it and moves the form onto the latest version.
   */
  readonly refetch?: EditContextRefetch;
};

/**
 * App-agnostic content-focus item detail (spec `002-pdf-viewer`, contract
 * `contracts/content-focus-view.md`) for an already-loaded `entityItem`, with no toolbar, page
 * layout or loading/error state of its own — the view above it (`@contentgrid/views/entity-item-
 * detail`) resolved the item and draws those. FR-001: an entity with no content attributes falls
 * back to the existing (stable) `EntityItemDetail` body; one that has them renders the PDF/content
 * preview beside the item's attributes and relations. The preview and relations load their own
 * follow-up data by following the item's links.
 */
export function EntityItemContentFocusBody({
  entityItem,
  refetch = noRefetch,
  onRelationItemClick,
  onRelationItemCreateNew,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<EntityItemContentFocusBodyProps>) {
  const { profileEntity } = entityItem;
  const { profiles: loadedProfiles } = useLoadedProfileEntities();

  // `undefined` means "use the data-model default" (selectDefaultContentAttribute); reset
  // whenever the item identity changes — entity OR id, not just id (navigating e.g.
  // /document/1 -> /invoice/1 keeps the same id with a different profileEntity) — so an
  // explicit choice for one item never leaks into the next (FR-006).
  const [userSelectedAttribute, setUserSelectedAttribute] = useState<string | undefined>(undefined);
  useEffect(() => {
    setUserSelectedAttribute(undefined);
  }, [profileEntity.name, entityItem.id]);

  // Defense in depth alongside the effect above: the effect only clears state AFTER the render
  // that already switched to the new profileEntity/id commits, so a stale
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
  const selectedAttribute =
    validUserSelectedAttribute ?? selectDefaultContentAttribute(profileEntity, entityItem);

  function handleRelationItemClick(relatedEntityName: string, relatedItemId: string): void {
    onRelationItemClick?.({ entityName: relatedEntityName, itemId: relatedItemId });
  }

  return profileEntity.hasContentAttributes ? (
    <ContentFocusEntityItemBody
      entityItem={entityItem}
      attributeName={selectedAttribute}
      onSelectAttribute={setUserSelectedAttribute}
      refetch={refetch}
      loadedProfiles={loadedProfiles}
      onRelationItemClick={handleRelationItemClick}
      onRelationItemCreateNew={onRelationItemCreateNew}
      onMissingRelationTargetClick={onMissingRelationTargetClick}
      onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
      onRequiredRelationClick={onRequiredRelationClick}
    />
  ) : (
    <EntityItemDetail
      item={entityItem}
      refetch={refetch}
      onRelationItemClick={handleRelationItemClick}
      onRelationItemCreateNew={onRelationItemCreateNew}
      onMissingRelationTargetClick={onMissingRelationTargetClick}
      onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
      onRequiredRelationClick={onRequiredRelationClick}
    />
  );
}

function ContentFocusEntityItemBody({
  entityItem,
  attributeName,
  onSelectAttribute,
  refetch,
  loadedProfiles,
  onRelationItemClick,
  onRelationItemCreateNew,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<{
  entityItem: EntityItem;
  /** `undefined` only when the profile's content-attribute list is somehow empty despite
   * `hasContentAttributes` being true — defensive; should not occur in practice. */
  attributeName: string | undefined;
  onSelectAttribute: (attributeName: string) => void;
  refetch: EditContextRefetch;
  loadedProfiles: readonly ProfileEntity[];
  /** Adapter already bound to the object-shaped `onRelationItemClick` prop on the outer view —
   * `RelationToOneSection`/`RelationToManySection` (from the stable `entity-item` feature) still
   * expect the two-positional-argument `RelationItemClickHandler` shape. */
  onRelationItemClick: (relatedEntityName: string, relatedItemId: string) => void;
}> &
  Pick<
    EntityItemContentFocusBodyProps,
    | "onRelationItemCreateNew"
    | "onMissingRelationTargetClick"
    | "onBlindRelationOverwriteClick"
    | "onRequiredRelationClick"
  >) {
  const editContext = useEditContext(entityItem, refetch);

  if (attributeName === undefined) {
    return null;
  }

  return (
    <RightSidePanelLayout
      sidePanelTitle="Details"
      // Round-2 review: show which item this panel belongs to (icon, name, subtitle) instead of
      // a generic "Details" label — same reference row `EntityItemDetail`'s own attribute-focus
      // body already shows above its attributes/relations (`entity-item-detail.tsx`). `sm` to fit
      // the panel's compact header bar; `sidePanelTitle` above still supplies the accessible name
      // for the collapse/expand button.
      sidePanelHeader={
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <EntityItemReference item={entityItem} size="sm" />
          <EditEntityItemButton
            item={entityItem}
            isEditing={editContext.isEditing}
            onEdit={() => editContext.setIsEditing(true)}
          />
        </div>
      }
      sidePanel={
        <div className="space-y-6">
          <EditableEntityItemAttributes
            item={editContext.editedItem ?? entityItem}
            isEditing={editContext.isEditing}
            onEditingChange={editContext.setIsEditing}
            onRefresh={() => void editContext.refresh()}
          />
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
                    onCreateNew={onRelationItemCreateNew}
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
                    onCreateNew={onRelationItemCreateNew}
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
    >
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
    </RightSidePanelLayout>
  );
}
