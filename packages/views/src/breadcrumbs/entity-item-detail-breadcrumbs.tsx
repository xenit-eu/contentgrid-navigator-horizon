import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
import { CollectionBreadcrumb } from "./collection-breadcrumb";
import { HomeBreadcrumb } from "./home-breadcrumb";
import { ItemBreadcrumb } from "./item-breadcrumb";

/** The item page's trail: Home › collection › item. */
export function EntityItemDetailBreadcrumbs({
  profileEntity,
  entityItem,
}: Readonly<{ profileEntity: ProfileEntity | undefined; entityItem: EntityItem | undefined }>) {
  return (
    <HomeBreadcrumb>
      <CollectionBreadcrumb profileEntity={profileEntity}>
        <ItemBreadcrumb entityItem={entityItem} />
      </CollectionBreadcrumb>
    </HomeBreadcrumb>
  );
}
