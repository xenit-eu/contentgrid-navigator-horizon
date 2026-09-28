import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RightSidePanelLayout } from "./right-side-panel-layout";

describe("RightSidePanelLayout", () => {
  it("collapsed: renders a single 'Show Details' toggle with aria-expanded=false", () => {
    render(
      <RightSidePanelLayout sidePanel={<div>Panel content</div>} defaultSidePanelOpen={false}>
        Main content
      </RightSidePanelLayout>,
    );

    const toggle = screen.getByRole("button", { name: "Show Details" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
  });

  it("collapsed: clicking the toggle opens the panel", async () => {
    const user = userEvent.setup();
    render(
      <RightSidePanelLayout sidePanel={<div>Panel content</div>} defaultSidePanelOpen={false}>
        Main content
      </RightSidePanelLayout>,
    );

    await user.click(screen.getByRole("button", { name: "Show Details" }));

    expect(screen.getByRole("button", { name: "Hide Details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("open: renders a 'Hide Details' toggle with aria-expanded=true", () => {
    render(
      <RightSidePanelLayout sidePanel={<div>Panel content</div>}>
        Main content
      </RightSidePanelLayout>,
    );

    expect(screen.getByRole("button", { name: "Hide Details" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("open: clicking the toggle collapses the panel", async () => {
    const user = userEvent.setup();
    render(
      <RightSidePanelLayout sidePanel={<div>Panel content</div>}>
        Main content
      </RightSidePanelLayout>,
    );

    await user.click(screen.getByRole("button", { name: "Hide Details" }));

    expect(screen.getByRole("button", { name: "Show Details" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
  });

  it("uses a custom sidePanelTitle in both toggle labels", () => {
    render(
      <RightSidePanelLayout sidePanel={<div>Panel content</div>} sidePanelTitle="Order info">
        Main content
      </RightSidePanelLayout>,
    );

    expect(screen.getByRole("button", { name: "Hide Order info" })).toBeInTheDocument();
  });
});
