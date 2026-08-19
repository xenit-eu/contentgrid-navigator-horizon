import { GearIcon } from "@phosphor-icons/react";
import { Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useAppAuth, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import {
  BrandingHeader,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarTrigger,
  ThemeToggle,
  UserMenu,
} from "@contentgrid/ui";

// ---------------------------------------------------------------------------
// SideBarLayout — pathless layout route component (sidebar + BrandingHeader + Outlet)
// ---------------------------------------------------------------------------

export function SideBarLayout() {
  const { entity: activeEntity } = useParams({ strict: false }) as { entity?: string };
  const navigate = useNavigate();
  const { auth } = useAppAuth();
  const { profiles: loadedProfiles, isLoading: isLoadingProfiles } = useLoadedProfileEntities();

  return (
    <SidebarProvider className="h-svh flex-col">
      <BrandingHeader
        actions={
          <>
            <SidebarTrigger />
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
        <Sidebar style={{ top: "3.75rem", height: "calc(100svh - 3.75rem)" }}>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Entities</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isLoadingProfiles
                    ? [1, 2, 3].map((i) => (
                        <SidebarMenuItem key={i}>
                          <SidebarMenuSkeleton />
                        </SidebarMenuItem>
                      ))
                    : loadedProfiles.map((profile) => (
                        <SidebarMenuItem key={profile.name}>
                          <SidebarMenuButton asChild isActive={activeEntity === profile.name}>
                            <Link
                              to={"/$entity" as string}
                              params={{ entity: profile.name } as Record<string, string>}
                            >
                              {profile.pluralName}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
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
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
