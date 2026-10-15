import type { ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from "@contentgrid/ui";
import { NavigationLink, useNavigation } from "../navigation";

/**
 * The root of every breadcrumb trail: Home, followed by its `children` crumbs. Like every crumb,
 * it is a link when crumbs follow it and the current page when it is last. The link is a real
 * `<a href>` when the host's navigation gives one (`hrefFor`); either way a plain click goes
 * through navigation.
 */
export function HomeBreadcrumb({ children }: Readonly<{ children?: ReactNode }>) {
  const navigation = useNavigation();
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {children ? (
            <BreadcrumbLink asChild>
              <NavigationLink
                href={navigation.hrefFor?.home()}
                onNavigate={() => navigation.openHome()}
              >
                Home
              </NavigationLink>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>Home</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {children}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
