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
    const { result } = renderHook(() => useNavigation());
    expect(() => {
      result.current.openHome();
      result.current.openEntityItemCollection("invoice");
      result.current.openItem("invoice", "1");
    }).not.toThrow();
    vi.unstubAllEnvs();
  });

  it("returns the provided navigation", async () => {
    const navigation: Navigation = {
      openHome: vi.fn(),
      openEntityItemCollection: vi.fn(),
      openItem: vi.fn(),
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
    await userEvent.click(screen.getByText("home"));
    expect(recording.calls).toEqual([
      { method: "openEntityItemCollection", args: ["invoice"] },
      { method: "openItem", args: ["invoice", "42"] },
      { method: "openHome", args: [] },
    ]);
  });

  it("provides a fresh recording when none is given", async () => {
    const Decorated = withRecordingNavigation();
    render(Decorated(NavButtons, {} as never));
    // Would throw without a provider in development.
    await userEvent.click(screen.getByText("home"));
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
