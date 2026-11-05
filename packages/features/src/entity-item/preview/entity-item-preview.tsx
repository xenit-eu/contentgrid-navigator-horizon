import { AttributeKind, type EntityItem } from "@contentgrid/navigator-data";
import { EntityItemAttributes } from "../attributes/entity-item-attributes";
import { ContentAttributeSelector } from "../variations/content-focus/components/content-attribute-selector";
import { ContentPreviewPanel } from "../variations/content-focus/components/content-preview-panel";
import { useSelectedContentAttribute } from "../variations/content-focus/util/use-selected-content-attribute";

/**
 * Whether the item holds at least one file: a content attribute whose value has metadata
 * (data-model.md: "a file exists iff `metadata !== null`"). An item whose content attributes are
 * all empty has no content to show.
 */
function entityItemHasContent(item: EntityItem): boolean {
  return item.attributes.some(
    (attr) => attr.value.kind === AttributeKind.CONTENT && attr.value.metadata !== null,
  );
}

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

  const [attributeName, setUserSelectedAttribute] = useSelectedContentAttribute(
    profileEntity,
    item,
  );

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
