import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLockup } from "./brand-lockup";

describe("BrandLockup", () => {
  it("defaults to the on-dark tone: white logo and content, accent grid, header-sub tagline", () => {
    render(<BrandLockup />);
    const logo = screen.getByRole("img", { name: "ContentGrid logo" });
    expect(logo).toHaveClass("size-[30px]");
    expect(logo.getAttribute("src")).toContain("blue-white");
    expect(screen.getByText("grid")).toHaveClass("text-[var(--brand-accent)]");
    expect(screen.getByText("grid").parentElement).toHaveClass("text-white");
    expect(screen.getByText("BY AMEXIO")).toHaveClass("text-[var(--header-sub)]", "text-[8px]");
  });

  it("renders the on-light tone with the dark logo, sky content, ocean grid and ocean tagline", () => {
    render(<BrandLockup tone="on-light" />);
    expect(screen.getByRole("img", { name: "ContentGrid logo" }).getAttribute("src")).toContain(
      "blue-dark",
    );
    expect(screen.getByText("grid")).toHaveClass("text-primary");
    expect(screen.getByText("grid").parentElement).toHaveClass("text-[var(--sky)]", "text-[17px]");
    expect(screen.getByText("BY AMEXIO")).toHaveClass(
      "text-primary",
      "text-[8px]",
      "tracking-[0.22em]",
    );
  });
});
