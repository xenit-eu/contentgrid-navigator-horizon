import { Outlet, createRootRoute, useNavigate, useParams } from "@tanstack/react-router";
import { NavigatorDataProvider, useAppAuth, useSelectedEntity } from "@contentgrid/navigator-data";
import { BrandingHeader, EntitySelector, SignInGate } from "@contentgrid/ui";
import type { Entity } from "@contentgrid/ui";

export const Route = createRootRoute({
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
  const { entities, setSelectedEntity } = useSelectedEntity();

  // URL is the runtime source of truth for which entity is displayed
  const { entity: urlEntity } = useParams({ strict: false }) as { entity?: string };
  const selectedEntity = entities.find((e) => e.name === urlEntity) ?? null;

  async function handleEntitySelect(entity: Entity) {
    setSelectedEntity(entities.find((e) => e.name === entity.name)!);
    await navigate({ to: "/$entity", params: { entity: entity.name } });
  }

  return (
    <div className="flex min-h-svh flex-col">
      <BrandingHeader
        title="Navigator"
        actions={
          <EntitySelector
            entities={entities}
            selectedEntity={selectedEntity ?? undefined}
            onSelect={handleEntitySelect}
          />
        }
      />
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
