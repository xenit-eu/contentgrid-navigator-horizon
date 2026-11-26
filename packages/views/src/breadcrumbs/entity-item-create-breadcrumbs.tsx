import type { ProfileEntity } from "@contentgrid/navigator-data";
import { BreadcrumbItem, BreadcrumbPage, BreadcrumbSeparator } from "@contentgrid/ui";
import { CollectionBreadcrumb } from "./collection-breadcrumb";
import { HomeBreadcrumb } from "./home-breadcrumb";

/** The create page's trail: Home › collection › Create <entity>. */
export function EntityItemCreateBreadcrumbs({
  profileEntity,
}: Readonly<{ profileEntity: ProfileEntity | undefined }>) {
  return (
    <HomeBreadcrumb>
      <CollectionBreadcrumb profileEntity={profileEntity}>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Create {profileEntity?.singularName}</BreadcrumbPage>
        </BreadcrumbItem>
      </CollectionBreadcrumb>
    </HomeBreadcrumb>
  );
}
