import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@contentgrid/ui";
import { NavigationLink, useNavigation } from "../navigation";

/**
 * Home, the entity's collection, then the item id. Every crumb is a real link when the host's
 * navigation gives one (`hrefFor`); either way, a plain click goes through navigation, never the
 * browser's own address bar handling.
 */
export function ItemDetailBreadcrumbs({
  entityName,
  pluralName,
  itemId,
}: Readonly<{ entityName: string; pluralName: string; itemId: string }>) {
  const navigation = useNavigation();
  const { hrefFor } = navigation;
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <NavigationLink href={hrefFor?.home()} onNavigate={() => navigation.openHome()}>
              Home
            </NavigationLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <NavigationLink
              href={hrefFor?.entityItemCollection(entityName)}
              onNavigate={() => navigation.openEntityItemCollection(entityName)}
            >
              {pluralName}
            </NavigationLink>
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
