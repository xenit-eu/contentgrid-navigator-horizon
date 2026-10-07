import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SEARCH_BAR_PROFILE_ROOT_URL,
  makeSearchBarProfiles,
} from "@contentgrid/navigator-data/test-fixtures/msw/search-bar-fixtures";
import { makeSearchBarWrapper } from "../entity-search-bar/test-utils";
import { useEntityDisplayPreferencesStore } from "./entity-display-preferences-store";
import { useSearchAttributeInclusion } from "./use-search-attribute-inclusion";

const backendDefaults = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return { ...actual, useEntityDisplayDefaults: () => ({ data: backendDefaults.value }) };
});

const { searchBar } = makeSearchBarProfiles();

function render() {
  return renderHook(() => useSearchAttributeInclusion(searchBar), {
    wrapper: makeSearchBarWrapper(),
  });
}

describe("useSearchAttributeInclusion", () => {
  afterEach(() => {
    backendDefaults.value = {};
    useEntityDisplayPreferencesStore.setState({ overrides: {} });
  });

  it("includes every attribute when no layer restricts them", () => {
    const { result } = render();
    expect(result.current.includedAttributes).toBe("all");
    expect(result.current.isIncluded("anything")).toBe(true);
  });

  it("follows the backend default", () => {
    backendDefaults.value = { "search-bar": { searchAttributes: ["title", "status"] } };
    const { result } = render();
    expect(result.current.isIncluded("title")).toBe(true);
    expect(result.current.isIncluded("reference")).toBe(false);
  });

  it("lets the user preference replace the backend default rather than add to it", () => {
    backendDefaults.value = { "search-bar": { searchAttributes: ["title", "status"] } };
    const { result } = render();
    act(() =>
      useEntityDisplayPreferencesStore
        .getState()
        .setOverride(SEARCH_BAR_PROFILE_ROOT_URL, "search-bar", {
          searchAttributes: ["reference"],
        }),
    );
    expect(result.current.includedAttributes).toEqual(new Set(["reference"]));
    expect(result.current.isIncluded("title")).toBe(false);
  });

  it("ignores names of attributes that no longer exist", () => {
    backendDefaults.value = { "search-bar": { searchAttributes: ["renamed_away"] } };
    const { result } = render();
    expect(result.current.isIncluded("title")).toBe(false);
    expect(result.current.isIncluded("renamed_away")).toBe(true);
  });
});
