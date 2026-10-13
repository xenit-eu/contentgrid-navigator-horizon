import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@contentgrid/ui";
import { useNavigation } from "../navigation";
import { HomeBreadcrumbItem } from "../toolbar/home-breadcrumb-item";

/** Home, the entity's collection, then the item id. Every crumb click goes through navigation. */
export function ItemDetailBreadcrumbs({
  entityName,
  pluralName,
  itemId,
}: Readonly<{ entityName: string; pluralName: string; itemId: string }>) {
  const navigation = useNavigation();
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <HomeBreadcrumbItem />
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button type="button" onClick={() => navigation.openEntityItemCollection(entityName)}>
              {pluralName}
            </button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{itemId}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
