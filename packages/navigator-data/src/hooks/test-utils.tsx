import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type TypedFetch,
  createApiClient,
  createContentClient,
} from "../api/client";
import { NavigatorDataProvider } from "./context";

// ---------------------------------------------------------------------------
// XHR stub — shared by api/content-upload.test.ts and use-content-upload.test.ts
// ---------------------------------------------------------------------------

export interface MockXhr {
  open: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  upload: { onprogress: ((e: Partial<ProgressEvent>) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  ontimeout: (() => void) | null;
  status: number;
}

export function makeFakeXhr(): {
  FakeXMLHttpRequest: new () => MockXhr;
  getLastXhr: () => MockXhr;
} {
  const instances: MockXhr[] = [];

  class FakeXHR implements MockXhr {
    open = vi.fn();
    setRequestHeader = vi.fn();
    send = vi.fn();
    abort = vi.fn();
    upload: { onprogress: ((e: Partial<ProgressEvent>) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    status = 204;

    constructor() {
      instances.push(this);
    }
  }

  return { FakeXMLHttpRequest: FakeXHR, getLastXhr: () => instances[instances.length - 1] };
}

export const BASE = "https://api.example.com";
export const PROFILE_URL = `${BASE}/profile`;

export const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

const noopGetToken = async () => "test-token";

export function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Build a React wrapper for renderHook tests.
 *
 * @param queryClient  - TanStack QueryClient to use; defaults to a fresh one.
 * @param apiFetch     - Optional TypedFetch to inject (e.g. a spy for header assertions).
 *                       Defaults to a real client using noopSupplier so MSW intercepts requests.
 * @param contentFetch - Optional binary TypedFetch (no Accept: hal+json).
 *                       Defaults to a real content client using noopSupplier.
 */
export function makeWrapper(
  queryClient = makeQueryClient(),
  apiFetch: TypedFetch = createApiClient(noopSupplier),
  contentFetch: TypedFetch = createContentClient(noopSupplier),
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          getToken={noopGetToken}
          profileUrl={PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  };
}
