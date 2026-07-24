import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandingHeader } from "./branding-header";

describe("BrandingHeader", () => {
  it("renders the title", () => {
    render(<BrandingHeader title="My App" />);
    expect(screen.getByText("My App")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<BrandingHeader title="My App" subtitle="Tagline here" />);
    expect(screen.getByText("Tagline here")).toBeInTheDocument();
  });

  it("does not render subtitle when omitted", () => {
    render(<BrandingHeader title="My App" />);
    expect(screen.queryByText(/tagline/i)).not.toBeInTheDocument();
  });

  it("renders logo image when logoUrl is provided", () => {
    render(<BrandingHeader title="My App" logoUrl="/logo.png" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/logo.png");
  });

  it("uses default alt text for logo when logoAlt is omitted", () => {
    render(<BrandingHeader title="My App" logoUrl="/logo.png" />);
    expect(screen.getByRole("img")).toHaveAttribute("alt", "My App logo");
  });

  it("uses custom logoAlt when provided", () => {
    render(<BrandingHeader title="My App" logoUrl="/logo.png" logoAlt="Custom alt" />);
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Custom alt");
  });

  it("does not render an img when logoUrl is omitted", () => {
    render(<BrandingHeader title="My App" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders actions slot when provided", () => {
    render(<BrandingHeader title="My App" actions={<button type="button">Settings</button>} />);
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("does not render actions container when actions is undefined", () => {
    const { container } = render(<BrandingHeader title="My App" />);
    // The trailing actions div is only rendered when actions is truthy
    expect(container.querySelector(".flex.shrink-0.items-center.gap-2")).not.toBeInTheDocument();
  });

  it("applies extra className to the root header element", () => {
    const { container } = render(<BrandingHeader title="My App" className="custom-class" />);
    expect(container.querySelector("header")).toHaveClass("custom-class");
  });

  it("renders a header element as root", () => {
    const { container } = render(<BrandingHeader title="My App" />);
    expect(container.querySelector("header")).toBeInTheDocument();
  });
});
