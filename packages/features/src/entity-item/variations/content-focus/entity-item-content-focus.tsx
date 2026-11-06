import { useEffect, useState } from "react";
import { useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { Separator } from "@contentgrid/ui";
import { DeleteEntityItemButton } from "../../../entity-item-delete";
import { RightSidePanelLayout } from "../../../layout";
import { EditableEntityItemAttributes } from "../../attributes/editable-entity-item-attributes";
import { EditEntityItemButton } from "../../edit/edit-entity-item-button";
import { RelationToManySection } from "../../relations/relation-to-many-section";
import { RelationToOneSection } from "../../relations/relation-to-one-section";
import { useEntityItemContext } from "../../use-entity-item-context";
import type { EntityItemVariationProps } from "../entity-item-variation-props";
import { EntityItemReference } from "../item-reference/entity-item-reference";
import { ContentAttributeSelector } from "./components/content-attribute-selector";
import { ContentPreviewPanel } from "./components/content-preview-panel";
import { selectDefaultContentAttribute } from "./util/select-default-content-attribute";

/**
 * Content-focus item detail (spec `002-pdf-viewer`, contract `contracts/content-focus-view.md`)
 * for an already-loaded item: a preview of one of its content attributes, with the item's
 * attributes and relations in a side panel. It draws no toolbar, page layout or loading/error state
 * of its own. The preview and relations load their own follow-up data by following the item's
 * links. Renders nothing when the item's profile has no content attributes.
 */
export function EntityItemContentFocus({
  item,
  refetch,
  onRelationItemClick,
  onRelationItemCreateNew,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
  actions,
  allowEdit = true,
  onDeleted,
}: Readonly<EntityItemVariationProps>) {
  const { profileEntity } = item;
  const { profiles: loadedProfiles } = useLoadedProfileEntities();
  const itemContext = useEntityItemContext(item, refetch);

  // `undefined` means "use the data-model default" (selectDefaultContentAttribute); reset
  // whenever the item identity changes — entity OR id, not just id (navigating e.g.
  // /document/1 -> /invoice/1 keeps the same id with a different profileEntity) — so an
  // explicit choice for one item never leaks into the next (FR-006).
  const [userSelectedAttribute, setUserSelectedAttribute] = useState<string | undefined>(undefined);
  useEffect(() => {
    setUserSelectedAttribute(undefined);
  }, [profileEntity.name, item.id]);

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
  // `undefined` only when the profile has no content attributes.
  const attributeName =
    validUserSelectedAttribute ?? selectDefaultContentAttribute(profileEntity, item);

  if (attributeName === undefined) {
    return null;
  }

  return (
    <RightSidePanelLayout
      sidePanelTitle="Details"
      // Round-2 review: show which item this panel belongs to (icon, name, subtitle) instead of
      // a generic "Details" label — same reference row `EntityItemAttributeFocus` already shows
      // above its attributes/relations (`entity-item-attribute-focus.tsx`). `sm` to fit the panel's
      // compact header bar; `sidePanelTitle` above still supplies the accessible name for the
      // collapse/expand button.
      sidePanelHeader={
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <EntityItemReference item={item} size="sm" />
          <div data-slot="item-actions" className="flex shrink-0 items-center gap-2">
            {actions}
            {allowEdit && (
              <EditEntityItemButton
                item={item}
                isEditing={itemContext.isEditing}
                onEdit={() => itemContext.setIsEditing(true)}
              />
            )}
            {onDeleted && <DeleteEntityItemButton item={item} onDeleted={onDeleted} />}
          </div>
        </div>
      }
      sidePanel={
        <div className="space-y-6">
          <EditableEntityItemAttributes
            item={itemContext.shownItem}
            isEditing={itemContext.isEditing}
            onEditingChange={itemContext.setIsEditing}
            onRefresh={() => void itemContext.refresh()}
          />
          {(item.toOneRelations.length > 0 || item.toManyRelations.length > 0) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Relations</h2>
                {item.toOneRelations.map((relation) => (
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
                {item.toManyRelations.map((relation) => (
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
        entityItem={item}
        attributeName={attributeName}
        toolbarStart={
          <ContentAttributeSelector
            entityItem={item}
            value={attributeName}
            onChange={setUserSelectedAttribute}
          />
        }
      />
    </RightSidePanelLayout>
  );
}
