import type { ReactNode } from "react";
import { FilePlusIcon, HouseIcon } from "@phosphor-icons/react";
import { useAppAuth, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import {
  BrandingHeader,
  Button,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarLinkButton,
  SidebarProvider,
  SidebarTrigger,
  ThemeToggle,
  UserMenu,
  useSidebar,
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
  homeHref,
  entityHref,
}: SideBarLayoutProps) {
  const { auth } = useAppAuth();
  const { profiles: loadedProfiles, isLoading: isLoadingProfiles } = useLoadedProfileEntities();

  return (
    <SidebarProvider className="h-svh flex-col">
      <BrandingHeader
        mobileLeading={<SidebarTrigger className="text-white hover:bg-white/10 hover:text-white" />}
        actions={
          <>
            <ThemeToggle />
            {auth.user && (
              <UserMenu
                name={auth.user.profile.name ?? auth.user.profile.email ?? ""}
                email={auth.user.profile.email ?? ""}
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
        <Sidebar style={{ top: "3.75rem", height: "calc(100svh - 3.75rem)" }} collapsible="icon">
          <SideBarTopControls onOpenHome={onOpenHome} homeHref={homeHref} />
          <SidebarContent>
            <SidebarGroup className="pb-0 mb-0">
              <SidebarCreateItemButton onOpenCreate={onOpenCreate} />
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

// The mobile sidebar always renders as a full-width Sheet with no icon-only
// mode, so it's treated the same as "expanded" here — only the desktop
// `open` state ever switches to the collapsed, icon-stacked layout.
function SideBarTopControls({
  onOpenHome,
  homeHref,
}: {
  readonly onOpenHome: () => void;
  readonly homeHref?: string;
}) {
  const { open, isMobile } = useSidebar();

  const homeContent = (
    <>
      <HouseIcon aria-hidden />
      <span className="sr-only">Home</span>
    </>
  );
  const home =
    homeHref === undefined ? (
      <Button variant="ghost" size="icon" className="size-7" onClick={onOpenHome}>
        {homeContent}
      </Button>
    ) : (
      <Button asChild variant="ghost" size="icon" className="size-7">
        <a href={homeHref} onClick={(event) => handleNavigationClick(event, onOpenHome)}>
          {homeContent}
        </a>
      </Button>
    );

  if (open || isMobile) {
    return (
      <div className="flex items-center justify-between gap-2 p-2">
        {home}
        <SidebarTrigger />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-2">
      <SidebarTrigger />
      {home}
    </div>
  );
}

function SidebarCreateItemButton({ onOpenCreate }: { readonly onOpenCreate: () => void }) {
  return (
    <SidebarLinkButton
      icon={<FilePlusIcon aria-hidden />}
      label="Create Item"
      variant="primary"
      onClick={onOpenCreate}
    />
  );
}
