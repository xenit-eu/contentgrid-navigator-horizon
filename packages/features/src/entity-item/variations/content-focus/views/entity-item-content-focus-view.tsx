import { useEffect, useState } from "react";
import {
  type EntityItem,
  type ProfileEntity,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import { Separator } from "@contentgrid/ui";
import { RightSidePanelLayout } from "../../../../layout";
import { EntityItemAttributes } from "../../../attributes/entity-item-attributes";
import { EntityItemView, type EntityItemViewProps } from "../../../entity-item-view";
import { RelationToManySection } from "../../../relations/relation-to-many-section";
import { RelationToOneSection } from "../../../relations/relation-to-one-section";
import { EntityItemReference } from "../../entity-item-reference";
import { ContentAttributeSelector } from "../components/content-attribute-selector";
import { ContentPreviewPanel } from "../components/content-preview-panel";
import { selectDefaultContentAttribute } from "../util/select-default-content-attribute";

export interface EntityItemContentFocusViewProps extends Pick<
  EntityItemViewProps,
  | "onRelationItemCreateNew"
  | "onMissingRelationTargetClick"
  | "onBlindRelationOverwriteClick"
  | "onRequiredRelationClick"
> {
  /** The item's profile. The caller (a view) owns loading it. */
  readonly profileEntity: ProfileEntity;
  /** The loaded item. The caller (a view) owns loading and revalidating it. */
  readonly entityItem: EntityItem;
  /** Fired when the user clicks through to a related entity item, from either a to-one or
   * to-many relation section in the side panel. */
  readonly onRelationItemClick?: (target: { entityName: string; itemId: string }) => void;
}

/**
 * App-agnostic content-focus item detail (spec `002-pdf-viewer`, contract
 * `contracts/content-focus-view.md`) for an already-loaded `profileEntity` + `entityItem`; the
 * view above it owns loading, the toolbar and page padding, and this fills the space it is given.
 * FR-001: an entity with no content attributes falls back to the existing (stable)
 * `EntityItemView` body; one that has them renders the PDF/content preview beside the item's
 * attributes and relations. The preview and relations load their own follow-up data by following
 * the item's links.
 */
export function EntityItemContentFocusView({
  profileEntity,
  entityItem,
  onRelationItemClick,
  onRelationItemCreateNew,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
}: Readonly<EntityItemContentFocusViewProps>) {
  const itemId = entityItem.id;
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

  const selectedAttribute =
    validUserSelectedAttribute ?? selectDefaultContentAttribute(profileEntity, entityItem);

  function handleRelationItemClick(relatedEntityName: string, relatedItemId: string): void {
    onRelationItemClick?.({ entityName: relatedEntityName, itemId: relatedItemId });
  }

  return (
    <div className="h-full min-h-0">
      {profileEntity.hasContentAttributes ? (
        <ContentFocusEntityItemBody
          entityItem={entityItem}
          attributeName={selectedAttribute}
          onSelectAttribute={setUserSelectedAttribute}
          loadedProfiles={loadedProfiles}
          onRelationItemClick={handleRelationItemClick}
          onRelationItemCreateNew={onRelationItemCreateNew}
          onMissingRelationTargetClick={onMissingRelationTargetClick}
          onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
          onRequiredRelationClick={onRequiredRelationClick}
        />
      ) : (
        <EntityItemView
          item={entityItem}
          onRelationItemClick={handleRelationItemClick}
          onRelationItemCreateNew={onRelationItemCreateNew}
          onMissingRelationTargetClick={onMissingRelationTargetClick}
          onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
          onRequiredRelationClick={onRequiredRelationClick}
        />
      )}
    </div>
  );
}

function ContentFocusEntityItemBody({
  entityItem,
  attributeName,
  onSelectAttribute,
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
  loadedProfiles: readonly ProfileEntity[];
  /** Adapter already bound to the object-shaped `onRelationItemClick` prop on the outer view —
   * `RelationToOneSection`/`RelationToManySection` (from the stable `entity-item` feature) still
   * expect the two-positional-argument `RelationItemClickHandler` shape. */
  onRelationItemClick: (relatedEntityName: string, relatedItemId: string) => void;
}> &
  Pick<
    EntityItemContentFocusViewProps,
    | "onRelationItemCreateNew"
    | "onMissingRelationTargetClick"
    | "onBlindRelationOverwriteClick"
    | "onRequiredRelationClick"
  >) {
  if (attributeName === undefined) {
    return null;
  }

  return (
    <RightSidePanelLayout
      sidePanelTitle="Details"
      // Round-2 review: show which item this panel belongs to (icon, name, subtitle) instead of
      // a generic "Details" label — same reference row `EntityItemView`'s own attribute-focus
      // body already shows above its attributes/relations (`entity-item-view.tsx`). `sm` to fit
      // the panel's compact header bar; `sidePanelTitle` above still supplies the accessible name
      // for the collapse/expand button.
      sidePanelHeader={<EntityItemReference item={entityItem} size="sm" />}
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
