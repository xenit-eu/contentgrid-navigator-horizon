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

  it("follows next links to accumulate all pages of options", async () => {
    const page1Href = REMOTE_OPTIONS_HREF;
    const page2Href = `${REMOTE_OPTIONS_HREF}?_cursor=page2`;

    const page1Fixture = {
      _links: {
        self: { href: page1Href },
        next: { href: page2Href },
      },
      _embedded: {
        item: [
          {
            title: "Electronics",
            _links: { self: { href: `${REMOTE_OPTIONS_HREF}/electronics` } },
          },
        ],
      },
    };
    const page2Fixture = {
      _links: {
        self: { href: page2Href },
        // no next link — last page
      },
      _embedded: {
        item: [
          {
            title: "Clothing",
            _links: { self: { href: `${REMOTE_OPTIONS_HREF}/clothing` } },
          },
          {
            title: "Books",
            _links: { self: { href: `${REMOTE_OPTIONS_HREF}/books` } },
          },
        ],
      },
    };

    server.use(
      http.get(page1Href, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("_cursor") === "page2") {
          return HttpResponse.json(page2Fixture);
        }
        return HttpResponse.json(page1Fixture);
      }),
    );

    const { result } = renderHook(() => useRemoteOptions(page1Href), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toEqual([
      { value: `${REMOTE_OPTIONS_HREF}/electronics`, prompt: "Electronics" },
      { value: `${REMOTE_OPTIONS_HREF}/clothing`, prompt: "Clothing" },
      { value: `${REMOTE_OPTIONS_HREF}/books`, prompt: "Books" },
    ]);
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
