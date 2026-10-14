import { BreadcrumbItem, BreadcrumbLink } from "@contentgrid/ui";
import { NavigationLink, useNavigation } from "../navigation";

/**
 * The Home crumb every breadcrumb trail starts with; renders a real `<a href>` when the host's
 * navigation gives one (`hrefFor`), otherwise a plain click still goes through navigation.
 */
export function HomeBreadcrumbItem() {
  const navigation = useNavigation();
  return (
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <NavigationLink href={navigation.hrefFor?.home()} onNavigate={() => navigation.openHome()}>
          Home
        </NavigationLink>
      </BreadcrumbLink>
    </BreadcrumbItem>
  );
}
