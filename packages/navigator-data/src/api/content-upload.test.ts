import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeXhr } from "../hooks/test-utils";
import { uploadContent } from "./content-upload";

const { FakeXMLHttpRequest, getLastXhr } = makeFakeXhr();

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeFile(name = "test.pdf", type = "application/pdf"): File {
  return new File(["content"], name, { type });
}

// ---------------------------------------------------------------------------
// uploadContent — request setup
// ---------------------------------------------------------------------------

describe("uploadContent — request setup", () => {
  it("opens a PUT request to the given URL", () => {
    uploadContent("https://api.example.com/content/1", makeFile(), null, vi.fn());
    expect(getLastXhr().open).toHaveBeenCalledWith(
      "PUT",
      "https://api.example.com/content/1",
      true,
    );
  });

  it("sets Authorization header when token is provided", () => {
    uploadContent("https://api.example.com/content/1", makeFile(), "my-token", vi.fn());
    expect(getLastXhr().setRequestHeader).toHaveBeenCalledWith("Authorization", "Bearer my-token");
  });

  it("does not set Authorization header when token is null", () => {
    uploadContent("https://api.example.com/content/1", makeFile(), null, vi.fn());
    expect(getLastXhr().setRequestHeader).not.toHaveBeenCalledWith(
      "Authorization",
      expect.any(String),
    );
  });

  it("sets Content-Type from file MIME type", () => {
    uploadContent(
      "https://api.example.com/content/1",
      makeFile("doc.pdf", "application/pdf"),
      null,
      vi.fn(),
    );
    expect(getLastXhr().setRequestHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
  });

  it("falls back to application/octet-stream when file has no MIME type", () => {
    const file = new File(["content"], "bin", { type: "" });
    uploadContent("https://api.example.com/content/1", file, null, vi.fn());
    expect(getLastXhr().setRequestHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/octet-stream",
    );
  });

  it("sends the file as the request body", () => {
    const file = makeFile();
    uploadContent("https://api.example.com/content/1", file, null, vi.fn());
    expect(getLastXhr().send).toHaveBeenCalledWith(file);
  });
});

// ---------------------------------------------------------------------------
// uploadContent — progress events
// ---------------------------------------------------------------------------

describe("uploadContent — progress events", () => {
  it("calls onProgress with integer percentage as bytes are uploaded", () => {
    const onProgress = vi.fn();
    uploadContent("https://api.example.com/content/1", makeFile(), null, onProgress);

    getLastXhr().upload.onprogress?.({ loaded: 50, total: 100, lengthComputable: true });
    expect(onProgress).toHaveBeenCalledWith(50);

    getLastXhr().upload.onprogress?.({ loaded: 75, total: 100, lengthComputable: true });
    expect(onProgress).toHaveBeenCalledWith(75);
  });

  it("does not call onProgress when length is not computable", () => {
    const onProgress = vi.fn();
    uploadContent("https://api.example.com/content/1", makeFile(), null, onProgress);
    getLastXhr().upload.onprogress?.({ loaded: 50, total: 0, lengthComputable: false });
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("calls onProgress(100) on successful load", async () => {
    const onProgress = vi.fn();
    const { promise } = uploadContent(
      "https://api.example.com/content/1",
      makeFile(),
      null,
      onProgress,
    );
    getLastXhr().status = 204;
    getLastXhr().onload?.();
    await promise;
    expect(onProgress).toHaveBeenLastCalledWith(100);
  });
});

// ---------------------------------------------------------------------------
// uploadContent — promise resolution
// ---------------------------------------------------------------------------

describe("uploadContent — promise resolution", () => {
  it("resolves the promise on HTTP 2xx", async () => {
    const { promise } = uploadContent(
      "https://api.example.com/content/1",
      makeFile(),
      null,
      vi.fn(),
    );
    getLastXhr().status = 204;
    getLastXhr().onload?.();
    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects the promise on HTTP 4xx", async () => {
    const { promise } = uploadContent(
      "https://api.example.com/content/1",
      makeFile(),
      null,
      vi.fn(),
    );
    getLastXhr().status = 403;
    getLastXhr().onload?.();
    await expect(promise).rejects.toThrow("HTTP 403");
  });

  it("rejects the promise on network error", async () => {
    const { promise } = uploadContent(
      "https://api.example.com/content/1",
      makeFile(),
      null,
      vi.fn(),
    );
    getLastXhr().onerror?.();
    await expect(promise).rejects.toThrow("network error");
  });

  it("rejects the promise on timeout", async () => {
    const { promise } = uploadContent(
      "https://api.example.com/content/1",
      makeFile(),
      null,
      vi.fn(),
    );
    getLastXhr().ontimeout?.();
    await expect(promise).rejects.toThrow("timeout");
  });
});

// ---------------------------------------------------------------------------
// uploadContent — abort
// ---------------------------------------------------------------------------

describe("uploadContent — abort", () => {
  it("calls xhr.abort() when abort() is called on the handle", () => {
    const { abort } = uploadContent("https://api.example.com/content/1", makeFile(), null, vi.fn());
    abort();
    expect(getLastXhr().abort).toHaveBeenCalledOnce();
  });
});
