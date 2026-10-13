import { BreadcrumbItem, BreadcrumbLink } from "@contentgrid/ui";
import { useNavigation } from "../navigation";

/** The Home crumb every breadcrumb trail starts with; its click goes through navigation. */
export function HomeBreadcrumbItem() {
  const navigation = useNavigation();
  return (
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <button type="button" onClick={() => navigation.openHome()}>
          Home
        </button>
      </BreadcrumbLink>
    </BreadcrumbItem>
  );
}
