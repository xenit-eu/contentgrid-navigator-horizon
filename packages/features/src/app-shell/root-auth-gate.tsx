import type { ReactNode } from "react";
import { NavigatorDataProvider, useAppAuth } from "@contentgrid/navigator-data";
import { SignInGate } from "@contentgrid/ui";

/**
 * Shared root-route auth gate for both navigator and navigator-experimental:
 * render nothing while auth is loading/refreshing, SignInGate when not
 * authenticated, otherwise wrap `children` in NavigatorDataProvider. Each
 * app's own root route supplies the differing layout as `children`
 * (navigator: header + main; navigator-experimental: experimental banner).
 */
export function RootAuthGate({ children }: Readonly<{ children: ReactNode }>) {
  const { auth, apiFetch, contentFetch, profileUrl } = useAppAuth();

  if (auth.isLoading || (auth.user?.expired && !auth.error)) {
    return null;
  }

  if (!auth.isAuthenticated) {
    return <SignInGate onSignIn={() => auth.signinRedirect()} />;
  }

  return (
    <NavigatorDataProvider apiFetch={apiFetch} contentFetch={contentFetch} profileUrl={profileUrl}>
      {children}
    </NavigatorDataProvider>
  );
}
