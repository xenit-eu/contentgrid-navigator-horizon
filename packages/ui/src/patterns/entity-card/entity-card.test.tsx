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

  it("renders header when provided", () => {
    render(<EntityCard {...baseProps} header="Entity Collection" />);
    expect(screen.getByText("Entity Collection")).toBeInTheDocument();
  });

  it("does not render header when omitted", () => {
    render(<EntityCard {...baseProps} />);
    expect(screen.queryByText("Entity Collection")).not.toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EntityCard {...baseProps} description="Entity description" />);
    expect(screen.getByText("Entity description")).toBeInTheDocument();
  });

  it("does not render description when omitted", () => {
    render(<EntityCard {...baseProps} />);
    expect(screen.queryByText("Entity description")).not.toBeInTheDocument();
  });

  it("renders a custom icon when provided", () => {
    render(<EntityCard {...baseProps} icon={<span data-testid="custom-icon" />} />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("defaults the title to the compact PageTitle size", () => {
    const { container } = render(<EntityCard {...baseProps} />);
    expect(container.querySelector('[data-slot="page-title"]')).toHaveAttribute(
      "data-size",
      "compact",
    );
  });

  it("forwards titleVariant to PageTitle's size", () => {
    const { container } = render(<EntityCard {...baseProps} titleVariant="default" />);
    expect(container.querySelector('[data-slot="page-title"]')).toHaveAttribute(
      "data-size",
      "default",
    );
  });

  it("calls onCardClick with the entity name when the card is clicked", async () => {
    const user = userEvent.setup();
    const onCardClick = vi.fn();
    render(<EntityCard {...baseProps} onCardClick={onCardClick} />);
    await user.click(screen.getByText("Invoice"));
    expect(onCardClick).toHaveBeenCalledWith("invoice");
  });

  it("does not throw when the card is clicked without onCardClick", async () => {
    const user = userEvent.setup();
    render(<EntityCard {...baseProps} />);
    await user.click(screen.getByText("Invoice"));
  });

  it("is keyboard-focusable and exposes role=button when onCardClick is provided", () => {
    render(<EntityCard {...baseProps} onCardClick={vi.fn()} />);
    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("tabIndex", "0");
  });

  it("is not focusable and has no button role when onCardClick is omitted", () => {
    render(<EntityCard {...baseProps} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onCardClick when Enter is pressed while the card is focused", async () => {
    const user = userEvent.setup();
    const onCardClick = vi.fn();
    render(<EntityCard {...baseProps} onCardClick={onCardClick} />);
    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");
    expect(onCardClick).toHaveBeenCalledWith("invoice");
  });

  it("calls onCardClick when Space is pressed while the card is focused", async () => {
    const user = userEvent.setup();
    const onCardClick = vi.fn();
    render(<EntityCard {...baseProps} onCardClick={onCardClick} />);
    screen.getByRole("button").focus();
    await user.keyboard(" ");
    expect(onCardClick).toHaveBeenCalledWith("invoice");
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

  it("does not call onCardClick when clicking interactive content inside the icon slot", async () => {
    const user = userEvent.setup();
    const onCardClick = vi.fn();
    const onIconClick = vi.fn();
    render(
      <EntityCard
        {...baseProps}
        onCardClick={onCardClick}
        icon={
          <button type="button" onClick={onIconClick}>
            Icon action
          </button>
        }
      />,
    );

    await user.click(screen.getByRole("button", { name: "Icon action" }));

    expect(onIconClick).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
