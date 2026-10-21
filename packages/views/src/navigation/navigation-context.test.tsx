import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChildNavigationProvider, NavigationProvider, useNavigation } from "./navigation-context";
import type { Navigation } from "./navigation-context";
import { createRecordingNavigation, withRecordingNavigation } from "./testing";

function NavButtons() {
  const navigation = useNavigation();
  return (
    <>
      <button onClick={() => navigation.openHome()}>home</button>
      <button onClick={() => navigation.openEntityItemCollection("invoice")}>list</button>
      <button onClick={() => navigation.openItem("invoice", "42")}>item</button>
      <button onClick={() => navigation.openCreateItem("invoice")}>create</button>
    </>
  );
}

describe("useNavigation", () => {
  it("throws a clear error without a provider in development", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useNavigation())).toThrow(/NavigationProvider/);
    error.mockRestore();
  });

  it("returns a no-op navigation without a provider outside development", () => {
    vi.stubEnv("DEV", false);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useNavigation());
    expect(() => {
      result.current.openHome();
      result.current.openEntityItemCollection("invoice");
      result.current.openItem("invoice", "1");
      result.current.openCreateItem("invoice");
    }).not.toThrow();
    error.mockRestore();
    vi.unstubAllEnvs();
  });

  it("logs a console error once when called repeatedly outside a provider in production", async () => {
    vi.stubEnv("DEV", false);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // Fresh module instance so the once-per-module flag starts unset, regardless of test order.
    vi.resetModules();
    const { useNavigation: freshUseNavigation } = await import("./navigation-context");
    renderHook(() => freshUseNavigation());
    renderHook(() => freshUseNavigation());
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toMatch(/useNavigation.*NavigationProvider/);
    error.mockRestore();
    vi.unstubAllEnvs();
  });

  it("returns the provided navigation", async () => {
    const navigation: Navigation = {
      openHome: vi.fn(),
      openEntityItemCollection: vi.fn(),
      openItem: vi.fn(),
      openCreateItem: vi.fn(),
    };
    render(
      <NavigationProvider navigation={navigation}>
        <NavButtons />
      </NavigationProvider>,
    );
    await userEvent.click(screen.getByText("item"));
    expect(navigation.openItem).toHaveBeenCalledWith("invoice", "42");
  });
});

describe("recording navigation", () => {
  it("records calls in order with their arguments", async () => {
    const recording = createRecordingNavigation();
    const Decorated = withRecordingNavigation(recording);
    render(Decorated(NavButtons, {} as never));
    await userEvent.click(screen.getByText("list"));
    await userEvent.click(screen.getByText("item"));
    await userEvent.click(screen.getByText("create"));
    await userEvent.click(screen.getByText("home"));
    expect(recording.calls).toEqual([
      { method: "openEntityItemCollection", args: ["invoice"] },
      { method: "openItem", args: ["invoice", "42"] },
      { method: "openCreateItem", args: ["invoice"] },
      { method: "openHome", args: [] },
    ]);
  });

  it("provides a fresh recording when none is given", async () => {
    const Decorated = withRecordingNavigation();
    render(Decorated(NavButtons, {} as never));
    // Would throw without a provider in development.
    await userEvent.click(screen.getByText("home"));
  });

  it("gives deterministic hrefs, independent of recorded calls", () => {
    const recording = createRecordingNavigation();
    expect(recording.navigation.hrefFor?.home()).toBe("/");
    expect(recording.navigation.hrefFor?.entityItemCollection("invoice")).toBe("/invoice");
    expect(recording.navigation.hrefFor?.item("invoice", "42")).toBe("/invoice/42");
    expect(recording.calls).toEqual([]);
  });
});

describe("ChildNavigationProvider", () => {
  it("routes overridden calls to the parent view and the rest to the host", async () => {
    const host = createRecordingNavigation();
    const openItem = vi.fn();
    render(
      <NavigationProvider navigation={host.navigation}>
        <ChildNavigationProvider overrides={{ openItem }}>
          <NavButtons />
        </ChildNavigationProvider>
      </NavigationProvider>,
    );
    await userEvent.click(screen.getByText("item"));
    await userEvent.click(screen.getByText("list"));
    await userEvent.click(screen.getByText("home"));
    expect(openItem).toHaveBeenCalledWith("invoice", "42");
    expect(host.calls).toEqual([
      { method: "openEntityItemCollection", args: ["invoice"] },
      { method: "openHome", args: [] },
    ]);
  });

  it("falls back to the parent's hrefFor when the child does not override it", () => {
    const host = createRecordingNavigation();
    let hrefFor: Navigation["hrefFor"];
    function ReadHrefFor() {
      hrefFor = useNavigation().hrefFor;
      return null;
    }
    render(
      <NavigationProvider navigation={host.navigation}>
        <ChildNavigationProvider overrides={{ openItem: vi.fn() }}>
          <ReadHrefFor />
        </ChildNavigationProvider>
      </NavigationProvider>,
    );
    expect(hrefFor?.item("invoice", "42")).toBe("/invoice/42");
  });

  it("uses the child's own hrefFor when it overrides one", () => {
    const host = createRecordingNavigation();
    const childHrefFor: Navigation["hrefFor"] = {
      home: () => "#home",
      entityItemCollection: (entityName) => `#${entityName}`,
      item: (entityName, id) => `#${entityName}/${id}`,
    };
    let hrefFor: Navigation["hrefFor"];
    function ReadHrefFor() {
      hrefFor = useNavigation().hrefFor;
      return null;
    }
    render(
      <NavigationProvider navigation={host.navigation}>
        <ChildNavigationProvider overrides={{ hrefFor: childHrefFor }}>
          <ReadHrefFor />
        </ChildNavigationProvider>
      </NavigationProvider>,
    );
    expect(hrefFor?.home()).toBe("#home");
  });

  it("falls back to the parent for openItem when it is not overridden", async () => {
    const host = createRecordingNavigation();
    const openHome = vi.fn();
    render(
      <NavigationProvider navigation={host.navigation}>
        <ChildNavigationProvider overrides={{ openHome }}>
          <NavButtons />
        </ChildNavigationProvider>
      </NavigationProvider>,
    );
    await userEvent.click(screen.getByText("item"));
    expect(host.calls).toEqual([{ method: "openItem", args: ["invoice", "42"] }]);
  });

  it("routes overridden openEntityItemCollection calls away from the parent", async () => {
    const host = createRecordingNavigation();
    const openEntityItemCollection = vi.fn();
    render(
      <NavigationProvider navigation={host.navigation}>
        <ChildNavigationProvider overrides={{ openEntityItemCollection }}>
          <NavButtons />
        </ChildNavigationProvider>
      </NavigationProvider>,
    );
    await userEvent.click(screen.getByText("list"));
    expect(openEntityItemCollection).toHaveBeenCalledWith("invoice");
    expect(host.calls).toEqual([]);
  });

  it("gives siblings independent navigation objects", async () => {
    const host = createRecordingNavigation();
    const left = vi.fn();
    const right = vi.fn();
    render(
      <NavigationProvider navigation={host.navigation}>
        <ChildNavigationProvider overrides={{ openHome: left }}>
          <NavButtons />
        </ChildNavigationProvider>
        <ChildNavigationProvider overrides={{ openHome: right }}>
          <NavButtons />
        </ChildNavigationProvider>
      </NavigationProvider>,
    );
    await userEvent.click(screen.getAllByText("home")[1]);
    expect(right).toHaveBeenCalledOnce();
    expect(left).not.toHaveBeenCalled();
  });
});
