import type { ReactNode } from "react";
import { Outlet, useParams } from "@tanstack/react-router";
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
      onOpenEntity={(entityName) =>
        navigation.openEntityItemCollection(entityName, { restoreState: false })
      }
      onOpenCreate={() => navigation.openClassifyCreate()}
      onOpenSettings={() => navigation.openSettings()}
      homeHref={hrefFor?.home()}
      entityHref={hrefFor && ((entityName) => hrefFor.entityItemCollection(entityName))}
    >
      <Outlet />
    </SideBarLayout>
  );
}
