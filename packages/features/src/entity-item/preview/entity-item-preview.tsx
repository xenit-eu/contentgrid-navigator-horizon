import { useEffect, useState } from "react";
import type { EntityItem } from "@contentgrid/navigator-data";
import { EntityItemAttributes } from "../attributes/entity-item-attributes";
import { ContentAttributeSelector } from "../variations/content-focus/components/content-attribute-selector";
import { ContentPreviewPanel } from "../variations/content-focus/components/content-preview-panel";
import { selectDefaultContentAttribute } from "../variations/content-focus/util/select-default-content-attribute";
import { entityItemHasContent } from "./entity-item-has-content";

export interface EntityItemPreviewProps {
  /** The loaded item (and, through it, its profile). The caller owns loading it. */
  readonly item: EntityItem;
}

/**
 * A read-only preview of an already-loaded item, for a pane next to a list: the item's content
 * when it holds a file (the same preview and attribute selector content focus uses, with no upload
 * drop zone), otherwise its attributes as a label/value table. It offers no edit, delete or
 * relation controls — the full detail variations do. It draws no toolbar or header and fills the
 * space its parent gives it (`h-full min-h-0`); the preview of a file follows the item's content
 * links itself.
 */
export function EntityItemPreview({ item }: Readonly<EntityItemPreviewProps>) {
  if (entityItemHasContent(item)) {
    return <EntityItemContentPreview item={item} />;
  }
  return (
    <div className="h-full min-h-0 overflow-auto p-4">
      <EntityItemAttributes item={item} />
    </div>
  );
}

function EntityItemContentPreview({ item }: Readonly<EntityItemPreviewProps>) {
  const { profileEntity } = item;

  // `undefined` means "use the data-model default" (selectDefaultContentAttribute); reset
  // whenever the item identity changes — entity or id — so a choice for one item never leaks
  // into the next (FR-006).
  const [userSelectedAttribute, setUserSelectedAttribute] = useState<string | undefined>(undefined);
  useEffect(() => {
    setUserSelectedAttribute(undefined);
  }, [profileEntity.name, item.id]);

  // The effect above only clears AFTER the render that switched item commits, so a stale choice
  // must not reach the panel for that one render (it throws for a non-content attribute).
  const isContentAttribute =
    userSelectedAttribute !== undefined &&
    profileEntity.userDefinedAttributes.some(
      (attr) => attr.isContent && attr.name === userSelectedAttribute,
    );
  const attributeName =
    (isContentAttribute ? userSelectedAttribute : undefined) ??
    selectDefaultContentAttribute(profileEntity, item);

  if (attributeName === undefined) return null;

  return (
    <div className="h-full min-h-0">
      <ContentPreviewPanel
        entityItem={item}
        attributeName={attributeName}
        readOnly
        toolbarStart={
          <ContentAttributeSelector
            entityItem={item}
            value={attributeName}
            onChange={setUserSelectedAttribute}
          />
        }
      />
    </div>
  );
}
