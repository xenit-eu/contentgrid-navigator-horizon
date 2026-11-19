import type { ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from "@contentgrid/ui";
import { NavigationLink, useViewNavigation } from "../navigation";

/**
 * The root of the settings trails: Settings, followed by its `children` crumbs. Like every crumb,
 * it is a link when crumbs follow it and the current page when it is last. The link is a real
 * `<a href>` when the host's navigation gives one (`hrefFor.settings`); either way a plain click
 * goes through navigation.
 */
export function SettingsBreadcrumb({ children }: Readonly<{ children?: ReactNode }>) {
  const navigation = useViewNavigation();
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {children ? (
            <BreadcrumbLink asChild>
              <NavigationLink
                href={navigation.hrefFor?.settings?.()}
                onNavigate={() => navigation.openSettings()}
              >
                Settings
              </NavigationLink>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>Settings</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {children}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
