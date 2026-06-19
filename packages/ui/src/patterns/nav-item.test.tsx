import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NavItem } from "./nav-item";

describe("NavItem", () => {
  it("renders label", () => {
    render(<NavItem label="Invoices" />);
    expect(screen.getByText("Invoices")).toBeInTheDocument();
  });

  it("is a button element", () => {
    render(<NavItem label="Invoices" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("active state sets aria-current=page", () => {
    render(<NavItem label="Invoices" active />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-current", "page");
  });

  it("inactive state has no aria-current", () => {
    render(<NavItem label="Invoices" active={false} />);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-current");
  });

  it("shows count when count prop is provided", () => {
    render(<NavItem label="Invoices" count={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("does not show count when count is not provided", () => {
    render(<NavItem label="Invoices" />);
    // No number should be visible beyond the label
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("shows count of 0 correctly", () => {
    render(<NavItem label="Invoices" count={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<NavItem label="Invoices" onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not throw when clicked without onClick handler", async () => {
    const user = userEvent.setup();
    render(<NavItem label="Invoices" />);
    await user.click(screen.getByRole("button"));
  });

  it("renders icon slot when icon prop is provided", () => {
    render(<NavItem label="Docs" icon={<span data-testid="folder-icon" />} />);
    expect(screen.getByTestId("folder-icon")).toBeInTheDocument();
  });

  it("active styling is applied when active=true", () => {
    const { container } = render(<NavItem label="Invoices" active />);
    const btn = container.querySelector("[data-slot='nav-item']");
    // active adds shadow inset class
    expect(btn?.className).toContain("shadow-[inset_2px_0_0_#019BE3]");
  });
});
