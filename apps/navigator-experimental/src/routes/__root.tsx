import { useEffect } from "react";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { useAuth } from "react-oidc-context";
import { ExperimentalBanner } from "../components/experimental-banner";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.error && auth.user?.expired) {
      auth.signinSilent().catch(() => auth.removeUser());
    }
  }, [auth]);

  if (auth.isLoading || (auth.user?.expired && !auth.error)) {
    return null;
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <button
          type="button"
          className="rounded bg-primary px-4 py-2 text-primary-foreground"
          onClick={() => auth.signinRedirect()}
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <>
      <ExperimentalBanner />
      <Outlet />
    </>
  );
}
