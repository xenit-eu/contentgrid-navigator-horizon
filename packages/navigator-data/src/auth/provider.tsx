import { AuthProvider as OidcAuthProvider } from "react-oidc-context";
import { getAppConfig, getOidcConfig } from "./auth-config";
import { DevAuthProvider } from "./dev-auth-provider";
import { getDevToken, isDevTokenMode } from "./dev-token";

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  if (isDevTokenMode()) {
    return <DevAuthProvider token={getDevToken()!}>{children}</DevAuthProvider>;
  }

  const config = getOidcConfig(getAppConfig());
  return <OidcAuthProvider {...config}>{children}</OidcAuthProvider>;
}
