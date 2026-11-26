import { ClassifyCreateEntityItemPanel } from "@contentgrid/features/entity-item-create";
import { useViewNavigation } from "../navigation";

export function ClassifyCreateEntityItemView() {
  const navigation = useViewNavigation();
  return (
    <ClassifyCreateEntityItemPanel
      onSelect={(profile) => navigation.openCreateItem(profile.name)}
      onCancel={() => navigation.openHome()}
    />
  );
}
