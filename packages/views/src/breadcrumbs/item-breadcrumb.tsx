import { EntityItemReference } from "@contentgrid/features/entity-item";
import type { EntityItem } from "@contentgrid/navigator-data";
import { BreadcrumbItem, BreadcrumbPage, BreadcrumbSeparator } from "@contentgrid/ui";
import { BREADCRUMB_TITLE_MAX_CHAR_LENGTH } from "./collection-breadcrumb";

/**
 * One item, shown as its reference, as the current page. A long title is truncated, with the full
 * title on hover. Draws nothing until the item has loaded — but it still counts as a following
 * crumb, so the collection before it stays a link while the item loads or after it failed.
 */
export function ItemBreadcrumb({ entityItem }: Readonly<{ entityItem: EntityItem | undefined }>) {
  if (!entityItem) return null;

  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbPage>
          <EntityItemReference
            item={entityItem}
            size="sm"
            titleMaxCharLength={BREADCRUMB_TITLE_MAX_CHAR_LENGTH}
          />
        </BreadcrumbPage>
      </BreadcrumbItem>
    </>
  );
}
