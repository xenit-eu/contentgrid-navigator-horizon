import { useEffect } from "react";
import { Outlet, createRootRoute, useNavigate } from "@tanstack/react-router";
import { NavigatorDataProvider, useAppAuth, useSelectedProfile } from "@contentgrid/navigator-data";
import { BrandingHeader, ProfileSelector, SignInGate } from "@contentgrid/ui";
import type { Profile } from "@contentgrid/ui";

export const Route = createRootRoute({
  validateSearch: (search: Record<string, unknown>) => ({
    entity: typeof search.entity === "string" ? search.entity : undefined,
  }),
  component: RootComponent,
});

function RootComponent() {
  const { auth, apiFetch, profileUrl } = useAppAuth();

  if (auth.isLoading || (auth.user?.expired && !auth.error)) {
    return null;
  }

  if (!auth.isAuthenticated) {
    return <SignInGate onSignIn={() => auth.signinRedirect()} />;
  }

  return (
    <NavigatorDataProvider apiFetch={apiFetch} profileUrl={profileUrl}>
      <AppLayout />
    </NavigatorDataProvider>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  // profiles + localStorage persistence; selectedProfile here is the localStorage-based default
  const { profiles, selectedProfile: defaultProfile, setSelectedProfile } = useSelectedProfile();

  // URL is the runtime source of truth for which entity is displayed
  const { entity: urlEntity } = Route.useSearch();
  const selectedProfile = profiles.find((p) => p.name === urlEntity) ?? null;

  // On initial load (no entity in URL), redirect to the saved or first profile
  useEffect(() => {
    if (!urlEntity && defaultProfile) {
      void navigate({
        to: "/",
        search: { entity: defaultProfile.name },
        replace: true,
      });
    }
  }, [urlEntity, defaultProfile, navigate]);

  function handleProfileSelect(profile: Profile) {
    const entityInfo = profiles.find((p) => p.name === profile.name);
    if (entityInfo) setSelectedProfile(entityInfo);
    void navigate({ to: "/", search: { entity: profile.name } });
  }

  return (
    <div className="flex min-h-svh flex-col">
      <BrandingHeader
        title="Navigator"
        actions={
          <ProfileSelector
            profiles={profiles}
            selectedProfile={selectedProfile ?? undefined}
            onSelect={handleProfileSelect}
          />
        }
      />
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
