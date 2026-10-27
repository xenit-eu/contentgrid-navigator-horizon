import type { ProfileEntity } from "@contentgrid/navigator-data";
import { CollectionBreadcrumb } from "./collection-breadcrumb";
import { HomeBreadcrumb } from "./home-breadcrumb";

/** The list page's trail: Home › collection. */
export function EntityItemCollectionBreadcrumbs({
  profileEntity,
}: Readonly<{ profileEntity: ProfileEntity | undefined }>) {
  return (
    <HomeBreadcrumb>
      <CollectionBreadcrumb profileEntity={profileEntity} />
    </HomeBreadcrumb>
  );
}
