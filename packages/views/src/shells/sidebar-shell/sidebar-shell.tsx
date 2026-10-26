import type { ReactNode } from "react";
import { GearIcon } from "@phosphor-icons/react";
import { Link, Outlet, useParams } from "@tanstack/react-router";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@contentgrid/ui";
import { SideBarLayout } from "../../layout";
import { useViewNavigation } from "../../navigation";

/**
 * The app's sidebar page frame: `SideBarLayout` wired to the router (active entity, routed
 * outlet) and to `useViewNavigation()` (every click that opens something). Host code, so it may
 * use the router; the layout it draws takes plain props only.
 */
export function SidebarShell({ topChildren }: Readonly<{ topChildren?: ReactNode }>) {
  const { entity: activeEntity } = useParams({ strict: false }) as { entity?: string };
  const navigation = useViewNavigation();
  const hrefFor = navigation.hrefFor;

  return (
    <SideBarLayout
      topChildren={topChildren}
      activeEntity={activeEntity}
      onOpenHome={() => navigation.openHome()}
      onOpenEntity={(entityName) => navigation.openEntityItemCollection(entityName)}
      onOpenCreate={() => navigation.openClassifyCreate()}
      onOpenSettings={() => navigation.openSettings()}
      homeHref={hrefFor?.home()}
      entityHref={hrefFor && ((entityName) => hrefFor.entityItemCollection(entityName))}
      footer={import.meta.env.DEV ? <DevAppSelectorLink /> : undefined}
    >
      <Outlet />
    </SideBarLayout>
  );
}

function DevAppSelectorLink() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          {/* `as string` bypasses TanStack Router's typed-route check: this shared package can't
              see either app's generated route tree, but /config exists in both apps. */}
          <Link to={"/config" as string}>
            <GearIcon aria-hidden />
            <span>App selector</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
