import { vi } from "vitest";

// ---------------------------------------------------------------------------
// XHR stub — upload progress is a transport detail MSW cannot synthesize
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
