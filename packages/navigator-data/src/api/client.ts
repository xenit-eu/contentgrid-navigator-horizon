import createBearerAuthenticationHook, {
  type AuthenticationTokenSupplier,
} from "@contentgrid/fetch-hook-authentication";
import createHook, { type FetchHook, compose } from "@contentgrid/fetch-hooks";
import { setHeader } from "@contentgrid/fetch-hooks/request";
import { ValueProviderResolver } from "@contentgrid/fetch-hooks/value-provider";
import { checkResponse } from "@contentgrid/problem-details";
import { createTypedFetch } from "@contentgrid/typed-fetch";
import { ACCEPT_HAL } from "./content-types";

// TypedFetch is defined in @contentgrid/typed-fetch's fetch.d.ts but not re-exported
// from its index.d.ts — this alias bridges the gap until upstream adds the export.
export type TypedFetch = ReturnType<typeof createTypedFetch>;

export type { AuthenticationTokenSupplier };

const problemDetailsHook = createHook(async (invocation) => {
  const response = await invocation.next();
  return checkResponse(response);
});

function bearerHook(tokenSupplier: AuthenticationTokenSupplier): FetchHook {
  return createBearerAuthenticationHook({
    tokenSupplier: ValueProviderResolver.constant(tokenSupplier),
  });
}

export function createApiClient(tokenSupplier: AuthenticationTokenSupplier): TypedFetch {
  const hookedFetch = compose(
    setHeader("Accept", ACCEPT_HAL),
    bearerHook(tokenSupplier),
    problemDetailsHook,
  )(globalThis.fetch);
  return createTypedFetch(hookedFetch);
}

export function createContentClient(tokenSupplier: AuthenticationTokenSupplier): TypedFetch {
  const hookedFetch = compose(bearerHook(tokenSupplier), problemDetailsHook)(globalThis.fetch);
  return createTypedFetch(hookedFetch);
}
