import type { ReactNode } from "react";
import { Outlet, useLocation, useParams } from "@tanstack/react-router";
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
  const currentPath = useLocation({ select: (location) => location.href.split(/[?#]/)[0] });
  const settingsHref = hrefFor?.settings?.();
  const settingsCurrent = settingsHref !== undefined && isWithin(currentPath, settingsHref);
  const homeHref = hrefFor?.home();
  const homeCurrent = homeHref !== undefined && isSamePath(currentPath, homeHref);

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
      settingsCurrent={settingsCurrent}
      settingsHref={settingsHref}
      homeCurrent={homeCurrent}
      homeHref={homeHref}
      entityHref={hrefFor && ((entityName) => hrefFor.entityItemCollection(entityName))}
    >
      <Outlet />
    </SideBarLayout>
  );
}

const trimSlashes = (value: string) => value.replace(/\/+$/, "");

/** `path` is exactly `target` (trailing slashes ignored): the home page has no sub-pages to include. */
function isSamePath(path: string, target: string): boolean {
  return trimSlashes(path) === trimSlashes(target);
}

/** `path` is `base` itself or one of its sub-pages (trailing slashes ignored). */
function isWithin(path: string, base: string): boolean {
  return isSamePath(path, base) || trimSlashes(path).startsWith(`${trimSlashes(base)}/`);
}
