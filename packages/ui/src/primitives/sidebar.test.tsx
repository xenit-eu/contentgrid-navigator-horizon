import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { SidebarProvider, SidebarTrigger } from "./sidebar";

beforeAll(() => {
  // jsdom does not implement window.matchMedia; SidebarProvider uses useIsMobile
  // which calls window.matchMedia to detect mobile breakpoint.
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

describe("SidebarTrigger", () => {
  it("renders toggle button with Phosphor SidebarSimple icon (svg)", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the sr-only Toggle Sidebar label", () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    expect(screen.getByText("Toggle Sidebar")).toBeInTheDocument();
  });
});
