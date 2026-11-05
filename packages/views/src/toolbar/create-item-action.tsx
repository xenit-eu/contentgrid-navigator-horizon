import type { ProfileEntity } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";
import { useViewNavigation } from "../navigation";

/**
 * The toolbar's "Create <entity>" button. Draws nothing unless the profile has a create form
 * (`createTemplate`), and opens the create page in a new tab, as before the views layer.
 */
export function CreateItemAction({
  profileEntity,
}: Readonly<{ profileEntity: ProfileEntity | undefined }>) {
  const navigation = useViewNavigation();
  if (!profileEntity?.createTemplate) return null;

  return (
    <Button onClick={() => navigation.openCreateItem(profileEntity.name, { openInNewTab: true })}>
      Create {profileEntity.singularName}
    </Button>
  );
}
