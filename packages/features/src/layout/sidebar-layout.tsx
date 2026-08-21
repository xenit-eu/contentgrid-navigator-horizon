import type { ReactNode } from "react";
import { GearIcon, HouseIcon, PlusIcon } from "@phosphor-icons/react";
import { Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useAppAuth, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import {
  BrandingHeader,
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarInset,
  SidebarLinkButton,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  ThemeToggle,
  UserMenu,
  useSidebar,
} from "@contentgrid/ui";
import { SidebarEntityNav } from "./sidebar-entity-nav";

// ---------------------------------------------------------------------------
// SideBarLayout — pathless layout route component (sidebar + BrandingHeader + Outlet)
// ---------------------------------------------------------------------------
type SideBarLayoutProps = {
  topChildren?: ReactNode;
};

export function SideBarLayout({ topChildren }: SideBarLayoutProps) {
  const { entity: activeEntity } = useParams({ strict: false }) as { entity?: string };
  const navigate = useNavigate();
  const { auth } = useAppAuth();
  const { profiles: loadedProfiles, isLoading: isLoadingProfiles } = useLoadedProfileEntities();

  return (
    <SidebarProvider className="h-svh flex-col">
      <BrandingHeader
        actions={
          <>
            <ThemeToggle />
            {auth.user && (
              <UserMenu
                name={auth.user.profile.name ?? auth.user.profile.email ?? ""}
                email={auth.user.profile.email ?? ""}
                onLogOut={() => auth.signoutRedirect()}
              />
            )}
          </>
        }
        className="sticky top-0 z-30 shrink-0"
        onLogoClick={() => navigate({ to: "/" as string })}
      />
      <div className="flex min-h-0 w-full flex-1">
        <Sidebar style={{ top: "3.75rem", height: "calc(100svh - 3.75rem)" }} collapsible="icon">
          <SideBarTopControls />
          <SidebarContent>
            <SidebarGroup className="pb-0 mb-0">
              <SidebarCreateItemLink />
            </SidebarGroup>
            <SidebarEntityNav
              profiles={loadedProfiles}
              isLoading={isLoadingProfiles}
              activeEntity={activeEntity}
            />
          </SidebarContent>

          {import.meta.env.DEV && (
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    {/* `as string` bypasses TanStack Router's typed-route check: this shared
                        feature package can't see either app's generated route tree, but
                        /config exists in both apps. */}
                    <Link to={"/config" as string}>
                      <GearIcon aria-hidden />
                      <span>App selector</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          )}
        </Sidebar>

        <SidebarInset className="min-h-0 overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto">
            {topChildren}
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

// The mobile sidebar always renders as a full-width Sheet with no icon-only
// mode, so it's treated the same as "expanded" here — only the desktop
// `open` state ever switches to the collapsed, icon-stacked layout.
function SideBarTopControls() {
  const { open, isMobile } = useSidebar();

  const home = (
    <Button asChild variant="ghost" size="icon" className="size-7">
      <Link to={"/" as string}>
        <HouseIcon aria-hidden />
        <span className="sr-only">Home</span>
      </Link>
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

// Looks like a link while expanded; once collapsed to icon-only there's no
// label left to read as a link, so it switches to a normal button icon.
function SidebarCreateItemLink() {
  const { open } = useSidebar();
  const navigate = useNavigate();

  return (
    <SidebarLinkButton
      icon={<PlusIcon aria-hidden />}
      label="Create Item"
      variant={open ? "link" : "default"}
      onClick={() => navigate({ to: "/" as string })}
    />
  );
}
