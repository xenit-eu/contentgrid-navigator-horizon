import { QueryClient } from "@tanstack/react-query";
import { vi } from "vitest";

/**
 * Minimal stand-in for a resolved ProfileEntity. Loader tests mock
 * ensureProfileEntityByName / ensureEntityItemCollection / ensureEntityItem
 * directly, so only referential identity matters here, not real
 * ProfileEntity behaviour.
 */
export const FAKE_PROFILE_ENTITY = { name: "invoice" } as unknown;

/** Router context shape every route loader in every app destructures. */
export function makeRouterContext() {
  return {
    queryClient: new QueryClient(),
    apiFetch: vi.fn(),
    profileUrl: "https://api.example.com/profile",
  };
}

/**
 * Route.options.loader is typed as `RouteLoaderFn | RouteLoaderObject` (the
 * latter has no call signature), a broader union than what createFileRoute's
 * inline loader option actually produces. Narrow once, at the test boundary,
 * to the concrete callable shape every loader is written with.
 */
export function castLoader<TArgs>(loader: unknown): (args: TArgs) => Promise<void> {
  return loader as unknown as (args: TArgs) => Promise<void>;
}
