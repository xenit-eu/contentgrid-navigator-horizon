import { Outlet, createRootRoute } from "@tanstack/react-router";
import { AppShell } from "@contentgrid/features/entity-browser";
import { NavigatorDataProvider, useAppAuth } from "@contentgrid/navigator-data";
import { SignInGate } from "@contentgrid/ui";
import { ExperimentalBanner } from "../components/experimental-banner";

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
      <AppShell>
        <ExperimentalBanner />
        <Outlet />
      </AppShell>
    </NavigatorDataProvider>
  );
}
