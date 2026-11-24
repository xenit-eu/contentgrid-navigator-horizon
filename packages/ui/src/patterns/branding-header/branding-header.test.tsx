import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BRANDING_HEADER_HEIGHT, BrandingHeader } from "./branding-header";

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

  it("calls onLogoClick when the logo/brand button is clicked", async () => {
    const onLogoClick = vi.fn();
    render(<BrandingHeader onLogoClick={onLogoClick} />);
    await userEvent.click(screen.getByRole("button", { name: /content.*grid.*by amexio/i }));
    expect(onLogoClick).toHaveBeenCalledTimes(1);
  });

  it("is 59px tall: 56px of content plus a 3px sky bottom border, with no separate accent strip", () => {
    const { container } = render(<BrandingHeader />);
    const header = container.querySelector("header");
    expect(BRANDING_HEADER_HEIGHT).toBe("59px");
    expect(header).toHaveStyle({ height: "59px" });
    expect(header).toHaveClass("border-b-[3px]", "border-[var(--sky)]");
    expect(header?.children).toHaveLength(2); // brand button + spacer
  });

  it("draws the brand with 'content' in white and 'grid' in the brand accent", () => {
    render(<BrandingHeader />);
    const grid = screen.getByText("grid");
    expect(grid).toHaveClass("text-[var(--brand-accent)]");
    expect(grid.parentElement).toHaveClass("text-white", "text-[17px]");
    expect(screen.getByText("BY AMEXIO")).toHaveClass(
      "text-[8px]",
      "tracking-[0.22em]",
      "text-[var(--header-sub)]",
    );
  });

  it("renders the leading slot right after the logo, with the logo still visible", () => {
    render(<BrandingHeader leading={<button type="button">Toggle</button>} />);
    const logo = screen.getByRole("button", { name: /content.*grid.*by amexio/i });
    const toggle = screen.getByRole("button", { name: "Toggle" });
    expect(logo.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(logo).not.toHaveClass("hidden");
    expect(toggle.parentElement).not.toHaveClass("md:hidden");
  });
});
