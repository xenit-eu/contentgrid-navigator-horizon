import { GearIcon } from "@phosphor-icons/react";
import { Link, Outlet, useParams } from "@tanstack/react-router";
import { useProfileEntities } from "@contentgrid/navigator-data";
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
} from "@contentgrid/ui";

// ---------------------------------------------------------------------------
// EntityListLayout — pathless layout route component (sidebar + BrandingHeader + Outlet)
// ---------------------------------------------------------------------------

export function EntityListLayout() {
  const { entity: activeEntity } = useParams({ strict: false }) as { entity?: string };

  const profileResults = useProfileEntities();
  const isLoadingProfiles = profileResults.length > 0 && profileResults.every((r) => r.isPending);
  const loadedProfiles = profileResults.filter((r) => r.data).map((r) => r.data!);
  const selectedProfile = activeEntity
    ? loadedProfiles.find((p) => p.name === activeEntity)
    : undefined;

  return (
    <SidebarProvider>
      <Sidebar>
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

      <SidebarInset>
        <BrandingHeader
          title="ContentGrid Navigator"
          subtitle={selectedProfile?.pluralName ?? "Entity browser"}
          actions={<SidebarTrigger />}
        />
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
