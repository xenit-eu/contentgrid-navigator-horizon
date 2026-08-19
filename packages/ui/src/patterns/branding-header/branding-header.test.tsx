import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandingHeader } from "./branding-header";

describe("BrandingHeader", () => {
  it("always renders the ContentGrid logo image", () => {
    render(<BrandingHeader />);
    expect(screen.getByRole("img", { name: "ContentGrid logo" })).toBeInTheDocument();
  });

  it("renders actions slot when provided", () => {
    render(<BrandingHeader actions={<button type="button">Settings</button>} />);
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("does not render actions container when actions is undefined", () => {
    const { container } = render(<BrandingHeader />);
    // The trailing actions div is only rendered when actions is truthy
    expect(container.querySelector(".flex.shrink-0.items-center.gap-2")).not.toBeInTheDocument();
  });

  it("applies extra className to the root header element", () => {
    const { container } = render(<BrandingHeader className="custom-class" />);
    expect(container.querySelector("header")).toHaveClass("custom-class");
  });

  it("renders a header element as root", () => {
    const { container } = render(<BrandingHeader />);
    expect(container.querySelector("header")).toBeInTheDocument();
  });

  it("renders all parts together: logo and actions", () => {
    render(<BrandingHeader actions={<span>action content</span>} />);
    expect(screen.getByRole("img", { name: "ContentGrid logo" })).toBeInTheDocument();
    expect(screen.getByText("action content")).toBeInTheDocument();
  });
});
