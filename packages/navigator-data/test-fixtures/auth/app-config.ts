import type { RuntimeAppConfig } from "../../src/auth/auth-config";

/**
 * A minimal, valid RuntimeAppConfig test double — for mocking `getAppConfig()`
 * wherever a caller only needs a real-shaped value to satisfy a downstream
 * call (e.g. `useCrossTabSignOut`'s effect), not to exercise config-loading
 * itself (see `auth-config.test.ts` for that).
 */
export function makeTestAppConfig(overrides: Partial<RuntimeAppConfig> = {}): RuntimeAppConfig {
  return {
    apiBaseUrl: "https://api.example.com",
    authority: "https://oidc.example.com",
    clientId: "client",
    ...overrides,
  };
}
