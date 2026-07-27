import { Suspense, lazy } from "react";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { NavigatorDataProvider, useAppAuth } from "@contentgrid/navigator-data";
import { SignInGate } from "@contentgrid/ui";
import { ExperimentalBanner } from "../components/experimental-banner";

// Dev-only: the Application Selector (from @contentgrid/dev-tools) is lazy-loaded
// behind import.meta.env.DEV so bundlers tree-shake it out of production builds.
// In a production (preview) build the package is dropped and logged-out users get
// the plain SignInGate instead. See packages/dev-tools/CLAUDE.md.
const ApplicationSelectorPage = import.meta.env.DEV
  ? lazy(() =>
      import("@contentgrid/dev-tools").then((m) => ({
        default: m.ApplicationSelectorPage,
      })),
    )
  : null;

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const { auth, apiFetch, contentFetch, profileUrl } = useAppAuth();

  if (auth.isLoading || (auth.user?.expired && !auth.error)) {
    return null;
  }

  if (!auth.isAuthenticated) {
    // Local dev: land on the Application Selector to choose a backend + Connect.
    // Production preview: selector is tree-shaken out, so show the sign-in gate.
    if (ApplicationSelectorPage) {
      return (
        <>
          <ExperimentalBanner />
          <Suspense fallback={null}>
            <ApplicationSelectorPage />
          </Suspense>
        </>
      );
    }
    return <SignInGate onSignIn={() => auth.signinRedirect()} />;
  }

  return (
    <NavigatorDataProvider apiFetch={apiFetch} contentFetch={contentFetch} profileUrl={profileUrl}>
      <>
        <ExperimentalBanner />
        <Outlet />
      </>
    </NavigatorDataProvider>
  );
}
