import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type TypedFetch,
  createApiClient,
  createContentClient,
  createContentUploadClient,
} from "../api/client";
import { NavigatorDataProvider } from "./context";

// ---------------------------------------------------------------------------
// XHR stub — shared by api/xhr-fetch.test.ts and hooks/item/use-content.test.tsx
// ---------------------------------------------------------------------------

export interface MockXhr {
  open: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  responseType: string;
  response: unknown;
  status: number;
  statusText: string;
  getAllResponseHeaders: ReturnType<typeof vi.fn>;
  upload: { onprogress: ((e: Partial<ProgressEvent>) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  ontimeout: (() => void) | null;
  onabort: (() => void) | null;
}

export function makeFakeXhr(): {
  FakeXMLHttpRequest: new () => MockXhr;
  getLastXhr: () => MockXhr | undefined;
} {
  const instances: MockXhr[] = [];

  class FakeXHR implements MockXhr {
    open = vi.fn();
    setRequestHeader = vi.fn();
    send = vi.fn();
    abort = vi.fn(() => {
      this.onabort?.();
    });
    responseType = "";
    response: unknown = undefined;
    status = 204;
    statusText = "";
    getAllResponseHeaders = vi.fn(() => "");
    upload: { onprogress: ((e: Partial<ProgressEvent>) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;

    constructor() {
      instances.push(this);
    }
  }

  return { FakeXMLHttpRequest: FakeXHR, getLastXhr: () => instances.at(-1) };
}

/**
 * Narrows a `getLastXhr()` result from `MockXhr | undefined` to `MockXhr`.
 * Use only once the test has already established that an instance must exist
 * (e.g. after a `waitFor` on `.send`, or synchronously right after invoking an
 * XHR-backed fetch) — throws with a clear message rather than masking a broken
 * assumption behind a non-null assertion.
 */
export function assertXhrExists(xhr: MockXhr | undefined): asserts xhr is MockXhr {
  if (xhr === undefined) {
    throw new Error("Expected makeFakeXhr() to have recorded an XHR instance by now");
  }
}

export const BASE = "https://api.example.com";
export const PROFILE_URL = `${BASE}/profile`;

export const noopSupplier: AuthenticationTokenSupplier = async () => ({
  token: "test-token",
  expiresAt: null,
});

export function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Build a React wrapper for renderHook tests.
 *
 * @param queryClient             - TanStack QueryClient to use; defaults to a fresh one.
 * @param apiFetch                - Optional TypedFetch to inject (e.g. a spy for header assertions).
 *                                  Defaults to a real client using noopSupplier so MSW intercepts requests.
 * @param contentFetch            - Optional TypedFetch for binary content (cg:content) requests.
 *                                  Defaults to a real content client using noopSupplier.
 * @param createContentUploadFetch - Optional factory for the progress-reporting upload client.
 *                                  Defaults to `createContentUploadClient` built from noopSupplier.
 */
export function makeWrapper(
  queryClient = makeQueryClient(),
  apiFetch: TypedFetch = createApiClient(noopSupplier),
  contentFetch: TypedFetch = createContentClient(noopSupplier),
  createContentUploadFetch: (onProgress?: (percentage: number) => void) => TypedFetch = (
    onProgress,
  ) => createContentUploadClient(noopSupplier, onProgress),
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          createContentUploadFetch={createContentUploadFetch}
          profileUrl={PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  };
}
