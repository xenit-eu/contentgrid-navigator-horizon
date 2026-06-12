import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import { BASE, makeWrapper } from "./test-utils";
import { useRemoteOptions } from "./use-remote-options";

const REMOTE_OPTIONS_HREF = `${BASE}/categories`;

/** MSW fixture: a HAL collection with embedded item resources */
const remoteOptionsFixture = {
  _links: {
    self: { href: REMOTE_OPTIONS_HREF },
  },
  _embedded: {
    item: [
      {
        title: "Electronics",
        _links: { self: { href: `${REMOTE_OPTIONS_HREF}/electronics` } },
      },
      {
        title: "Clothing",
        _links: { self: { href: `${REMOTE_OPTIONS_HREF}/clothing` } },
      },
      {
        // No title — falls back to last path segment of self href
        _links: { self: { href: `${REMOTE_OPTIONS_HREF}/other` } },
      },
    ],
  },
};

describe("useRemoteOptions", () => {
  it("fetches a remote options resource and returns normalised { value, prompt }[] pairs", async () => {
    server.use(http.get(REMOTE_OPTIONS_HREF, () => HttpResponse.json(remoteOptionsFixture)));

    const { result } = renderHook(() => useRemoteOptions(REMOTE_OPTIONS_HREF), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toEqual([
      { value: `${REMOTE_OPTIONS_HREF}/electronics`, prompt: "Electronics" },
      { value: `${REMOTE_OPTIONS_HREF}/clothing`, prompt: "Clothing" },
      { value: `${REMOTE_OPTIONS_HREF}/other`, prompt: "other" },
    ]);
  });

  it("is disabled when href is undefined", () => {
    const { result } = renderHook(() => useRemoteOptions(undefined), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("is disabled when href is null", () => {
    const { result } = renderHook(() => useRemoteOptions(null), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("skips items without a self link", async () => {
    const fixtureWithMissingSelf = {
      _links: { self: { href: REMOTE_OPTIONS_HREF } },
      _embedded: {
        item: [
          {
            title: "Valid",
            _links: { self: { href: `${REMOTE_OPTIONS_HREF}/valid` } },
          },
          {
            title: "No Self Link",
            _links: {},
          },
        ],
      },
    };

    server.use(http.get(REMOTE_OPTIONS_HREF, () => HttpResponse.json(fixtureWithMissingSelf)));

    const { result } = renderHook(() => useRemoteOptions(REMOTE_OPTIONS_HREF), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    // Only the item with a self link should appear
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].value).toBe(`${REMOTE_OPTIONS_HREF}/valid`);
  });
});
