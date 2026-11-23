import type { ReactNode } from "react";
import { HouseIcon, PlusIcon } from "@phosphor-icons/react";
import { useAppAuth, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import {
  BRANDING_HEADER_HEIGHT,
  BrandingHeader,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarLinkButton,
  SidebarMenu,
  SidebarProvider,
  SidebarTrigger,
  UserMenu,
} from "@contentgrid/ui";
import { handleNavigationClick } from "../navigation";
import { SidebarEntityNav } from "./sidebar-entity-nav";

// ---------------------------------------------------------------------------
// SideBarLayout — sidebar + BrandingHeader around the routed page
// ---------------------------------------------------------------------------
export interface SideBarLayoutProps {
  /** The routed page. */
  readonly children: ReactNode;
  readonly topChildren?: ReactNode;
  /** The `name` of the entity whose pages are currently shown, highlighted in the sidebar. */
  readonly activeEntity?: string;
  readonly onOpenHome: () => void;
  readonly onOpenEntity: (entityName: string) => void;
  readonly onOpenCreate: () => void;
  readonly onOpenSettings: () => void;
  /** A settings page is open: the user menu's Settings item shows its "current" state. */
  readonly settingsCurrent?: boolean;
  /** The home page is open: the Home row shows its "current" state. */
  readonly homeCurrent?: boolean;
  /** Real addresses, when the host has them: the home and entity links then render as `<a href>`. */
  readonly homeHref?: string;
  readonly entityHref?: (entityName: string) => string;
}

export function SideBarLayout({
  children,
  topChildren,
  activeEntity,
  onOpenHome,
  onOpenEntity,
  onOpenCreate,
  onOpenSettings,
  settingsCurrent,
  homeCurrent,
  homeHref,
  entityHref,
}: SideBarLayoutProps) {
  const { auth } = useAppAuth();
  const { profiles: loadedProfiles, isLoading: isLoadingProfiles } = useLoadedProfileEntities();

  return (
    <SidebarProvider className="h-svh flex-col">
      <BrandingHeader
        leading={<SidebarTrigger className="text-white hover:bg-white/10 hover:text-white" />}
        actions={
          <>
            {auth.user && (
              <UserMenu
                name={auth.user.profile.name ?? auth.user.profile.email ?? ""}
                email={auth.user.profile.email ?? ""}
                settingsCurrent={settingsCurrent}
                onSettingsClick={onOpenSettings}
                onLogOut={() => auth.signoutRedirect()}
              />
            )}
          </>
        }
        className="sticky top-0 z-30 shrink-0"
        onLogoClick={onOpenHome}
      />
      <div className="flex min-h-0 w-full flex-1">
        <Sidebar
          style={{
            top: BRANDING_HEADER_HEIGHT,
            height: `calc(100svh - ${BRANDING_HEADER_HEIGHT})`,
          }}
          collapsible="icon"
        >
          <SidebarContent>
            <SidebarGroup className="pb-0">
              <SidebarMenu>
                <SidebarLinkButton
                  icon={<PlusIcon aria-hidden />}
                  label="Create"
                  variant="primary"
                  className="mb-2.5"
                  onClick={onOpenCreate}
                />
                <SidebarLinkButton
                  icon={<HouseIcon aria-hidden />}
                  label="Home"
                  isActive={homeCurrent}
                  aria-current={homeCurrent ? "page" : undefined}
                  onClick={homeHref === undefined ? onOpenHome : undefined}
                  render={
                    homeHref === undefined
                      ? undefined
                      : (content) => (
                          <a
                            href={homeHref}
                            onClick={(event) => handleNavigationClick(event, onOpenHome)}
                          >
                            {content}
                          </a>
                        )
                  }
                />
              </SidebarMenu>
            </SidebarGroup>
            <SidebarEntityNav
              profiles={loadedProfiles}
              isLoading={isLoadingProfiles}
              activeEntity={activeEntity}
              onOpenEntity={onOpenEntity}
              entityHref={entityHref}
            />
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="min-h-0 overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto">
            {topChildren}
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
