import type { ProfileEntity } from "@contentgrid/navigator-data";
import { CollectionBreadcrumb } from "./collection-breadcrumb";
import { SettingsBreadcrumb } from "./settings-breadcrumb";

/** An entity's configuration page trail: Settings › entity (its badge and plural name). */
export function EntityConfigurationBreadcrumbs({
  profileEntity,
}: Readonly<{ profileEntity: ProfileEntity | undefined }>) {
  return (
    <SettingsBreadcrumb>
      <CollectionBreadcrumb profileEntity={profileEntity} />
    </SettingsBreadcrumb>
  );
}
