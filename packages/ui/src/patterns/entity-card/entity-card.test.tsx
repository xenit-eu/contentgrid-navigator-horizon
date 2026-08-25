import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityCard } from "./entity-card";

describe("EntityCard", () => {
  const baseProps = { name: "invoice", title: "Invoice" };

  it("renders the entity title", () => {
    render(<EntityCard {...baseProps} />);
    expect(screen.getByText("Invoice")).toBeInTheDocument();
  });

  it("renders children in the card body", () => {
    render(<EntityCard {...baseProps}>Body content</EntityCard>);
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("renders no body when children are omitted", () => {
    const { container } = render(<EntityCard {...baseProps} />);
    expect(container.querySelector('[data-slot="card-content"]')).not.toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EntityCard {...baseProps} description="Entity description" />);
    expect(screen.getByText("Entity description")).toBeInTheDocument();
  });

  it("does not render description when omitted", () => {
    render(<EntityCard {...baseProps} />);
    expect(screen.queryByText("Entity description")).not.toBeInTheDocument();
  });

  it("renders a default icon when none is provided", () => {
    const { container } = render(<EntityCard {...baseProps} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders a custom icon when provided", () => {
    render(<EntityCard {...baseProps} icon={<span data-testid="custom-icon" />} />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("calls onTitleClick with the entity name when the title button is clicked", async () => {
    const user = userEvent.setup();
    const onTitleClick = vi.fn();
    render(<EntityCard {...baseProps} onTitleClick={onTitleClick} />);
    await user.click(screen.getByText("Invoice"));
    expect(onTitleClick).toHaveBeenCalledWith("invoice");
  });

  it("does not throw when the title button is clicked without onTitleClick", async () => {
    const user = userEvent.setup();
    render(<EntityCard {...baseProps} />);
    await user.click(screen.getByText("Invoice"));
  });

  it("renders no action slot when omitted", () => {
    render(<EntityCard {...baseProps} />);
    expect(screen.queryByRole("button", { name: /create/i })).not.toBeInTheDocument();
  });

  it("renders and wires up an arbitrary action element", async () => {
    const user = userEvent.setup();
    const onCreateClick = vi.fn();
    render(
      <EntityCard
        {...baseProps}
        action={
          <button type="button" onClick={onCreateClick}>
            Create Invoice
          </button>
        }
      />,
    );
    await user.click(screen.getByRole("button", { name: "Create Invoice" }));
    expect(onCreateClick).toHaveBeenCalledTimes(1);
  });

  it("tints the icon badge background with color-mix when a color is provided", () => {
    const { container } = render(<EntityCard {...baseProps} color="oklch(0.55 0.17 155)" />);
    const badge = container.querySelector('[data-slot="entity-card-icon"]') as HTMLElement;
    expect(badge.style.backgroundColor).toBe(
      "color-mix(in oklch, oklch(0.55 0.17 155) 18%, transparent)",
    );
    expect(badge.style.borderColor).toBe("");
  });

  it("leaves the icon badge unstyled when no color is provided", () => {
    const { container } = render(<EntityCard {...baseProps} />);
    const badge = container.querySelector('[data-slot="entity-card-icon"]') as HTMLElement;
    expect(badge.style.backgroundColor).toBe("");
  });

  it("does not tint the rest of the card, only the icon badge", () => {
    const { container } = render(<EntityCard {...baseProps} color="oklch(0.55 0.17 155)" />);
    const card = container.querySelector('[data-slot="card"]') as HTMLElement;
    expect(card.style.backgroundColor).toBe("");
  });

  it("does not call onTitleClick when clicking interactive content inside the icon slot", async () => {
    const user = userEvent.setup();
    const onTitleClick = vi.fn();
    const onIconClick = vi.fn();
    render(
      <EntityCard
        {...baseProps}
        onTitleClick={onTitleClick}
        icon={
          <button type="button" onClick={onIconClick}>
            Icon action
          </button>
        }
      />,
    );

    await user.click(screen.getByRole("button", { name: "Icon action" }));

    expect(onIconClick).toHaveBeenCalledTimes(1);
    expect(onTitleClick).not.toHaveBeenCalled();
  });
});
