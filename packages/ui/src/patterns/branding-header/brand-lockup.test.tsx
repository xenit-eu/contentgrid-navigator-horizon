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
    expect(document.querySelector("img[src*='blue-dark']")).toBeInTheDocument();
    expect(screen.getByText("grid")).toHaveClass("text-primary");
    expect(screen.getByText("grid").parentElement).toHaveClass("text-[var(--sky)]", "text-[17px]");
    expect(screen.getByText("BY AMEXIO")).toHaveClass(
      "text-primary",
      "text-[8px]",
      "tracking-[0.22em]",
    );
  });

  it("on-light follows the on-dark colours in dark mode, with only one logo displayed", () => {
    render(<BrandLockup tone="on-light" />);
    const light = document.querySelector("img[src*='blue-dark']");
    const dark = document.querySelector("img[src*='blue-white']");
    expect(light).toHaveClass("dark:hidden");
    expect(dark).toHaveClass("hidden", "dark:block");
    expect(screen.getByText("grid")).toHaveClass("dark:text-[var(--brand-accent)]");
    expect(screen.getByText("grid").parentElement).toHaveClass("dark:text-white");
    expect(screen.getByText("BY AMEXIO")).toHaveClass("dark:text-[var(--header-sub)]");
  });

  it("on-dark renders a single, unconditional logo", () => {
    render(<BrandLockup />);
    expect(document.querySelectorAll("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "ContentGrid logo" }).className).not.toContain("dark:");
  });
});
