import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeXhr, makeWrapper } from "./test-utils";
import { useContentUpload } from "./use-content-upload";

const { FakeXMLHttpRequest, getLastXhr } = makeFakeXhr();

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeFile(name = "photo.png", type = "image/png"): File {
  return new File(["data"], name, { type });
}

const CONTENT_URL = "https://api.example.com/content/1";

describe("useContentUpload — initial state", () => {
  it("starts in idle state with zero progress", () => {
    const { result } = renderHook(() => useContentUpload(CONTENT_URL, makeFile()), {
      wrapper: makeWrapper(),
    });
    expect(result.current.uploadState).toEqual({ status: "idle", progress: 0 });
  });
});

describe("useContentUpload — upload()", () => {
  it("transitions to uploading status when upload() is called", async () => {
    const { result } = renderHook(() => useContentUpload(CONTENT_URL, makeFile()), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.upload());

    await waitFor(() => {
      expect(result.current.uploadState.status).toBe("uploading");
    });
  });

  it("updates progress as XHR reports bytes sent", async () => {
    const { result } = renderHook(() => useContentUpload(CONTENT_URL, makeFile()), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.upload());
    await waitFor(() => expect(result.current.uploadState.status).toBe("uploading"));

    act(() => {
      getLastXhr().upload.onprogress?.({ loaded: 40, total: 100, lengthComputable: true });
    });
    expect(result.current.uploadState.progress).toBe(40);

    act(() => {
      getLastXhr().upload.onprogress?.({ loaded: 80, total: 100, lengthComputable: true });
    });
    expect(result.current.uploadState.progress).toBe(80);
  });

  it("transitions to done on HTTP 2xx", async () => {
    const { result } = renderHook(() => useContentUpload(CONTENT_URL, makeFile()), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.upload());
    await waitFor(() => expect(result.current.uploadState.status).toBe("uploading"));

    act(() => {
      getLastXhr().status = 204;
      getLastXhr().onload?.();
    });

    await waitFor(() => {
      expect(result.current.uploadState).toEqual({ status: "done", progress: 100 });
    });
  });

  it("transitions to error on HTTP 4xx", async () => {
    const { result } = renderHook(() => useContentUpload(CONTENT_URL, makeFile()), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.upload());
    await waitFor(() => expect(result.current.uploadState.status).toBe("uploading"));

    act(() => {
      getLastXhr().status = 403;
      getLastXhr().onload?.();
    });

    await waitFor(() => {
      expect(result.current.uploadState.status).toBe("error");
    });
  });

  it("transitions to error on network failure", async () => {
    const { result } = renderHook(() => useContentUpload(CONTENT_URL, makeFile()), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.upload());
    await waitFor(() => expect(result.current.uploadState.status).toBe("uploading"));

    act(() => getLastXhr().onerror?.());

    await waitFor(() => {
      expect(result.current.uploadState.status).toBe("error");
    });
  });

  it("does nothing when url is null", () => {
    const { result } = renderHook(() => useContentUpload(null, makeFile()), {
      wrapper: makeWrapper(),
    });
    act(() => result.current.upload());
    expect(result.current.uploadState.status).toBe("idle");
  });

  it("does nothing when file is null", () => {
    const { result } = renderHook(() => useContentUpload(CONTENT_URL, null), {
      wrapper: makeWrapper(),
    });
    act(() => result.current.upload());
    expect(result.current.uploadState.status).toBe("idle");
  });
});

describe("useContentUpload — cancel()", () => {
  it("aborts the XHR and resets to idle", async () => {
    const { result } = renderHook(() => useContentUpload(CONTENT_URL, makeFile()), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.upload());
    await waitFor(() => expect(result.current.uploadState.status).toBe("uploading"));

    act(() => result.current.cancel());

    expect(getLastXhr().abort).toHaveBeenCalledOnce();
    expect(result.current.uploadState).toEqual({ status: "idle", progress: 0 });
  });
});

describe("useContentUpload — retry()", () => {
  it("re-runs the last upload after a failure", async () => {
    const { result } = renderHook(() => useContentUpload(CONTENT_URL, makeFile()), {
      wrapper: makeWrapper(),
    });

    // First upload — fail
    act(() => result.current.upload());
    await waitFor(() => expect(result.current.uploadState.status).toBe("uploading"));
    act(() => getLastXhr().onerror?.());
    await waitFor(() => expect(result.current.uploadState.status).toBe("error"));

    // Retry
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.uploadState.status).toBe("uploading"));

    // Second XHR succeeds
    act(() => {
      getLastXhr().status = 204;
      getLastXhr().onload?.();
    });
    await waitFor(() => {
      expect(result.current.uploadState.status).toBe("done");
    });
  });

  it("does nothing when retry() is called before any upload", () => {
    const { result } = renderHook(() => useContentUpload(CONTENT_URL, makeFile()), {
      wrapper: makeWrapper(),
    });
    act(() => result.current.retry());
    expect(result.current.uploadState.status).toBe("idle");
  });
});
