import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityCard, EntityCardDescription, EntityCardTitle } from "./entity-card";

describe("EntityCard", () => {
  it("is a plain card without onOpen", () => {
    render(<EntityCard>Invoices</EntityCard>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens on a click", async () => {
    const onOpen = vi.fn();
    render(<EntityCard onOpen={onOpen}>Invoices</EntityCard>);

    await userEvent.click(screen.getByRole("button", { name: "Invoices" }));

    expect(onOpen).toHaveBeenCalledOnce();
  });

  it.each(["{Enter}", " "])("opens on %s from the keyboard", async (key) => {
    const onOpen = vi.fn();
    render(<EntityCard onOpen={onOpen}>Invoices</EntityCard>);

    screen.getByRole("button").focus();
    await userEvent.keyboard(key);

    expect(onOpen).toHaveBeenCalledOnce();
  });
});

describe("EntityCardTitle and EntityCardDescription", () => {
  it("show their full text on hover, since long text is cut", () => {
    render(
      <>
        <EntityCardTitle>Purchase orders</EntityCardTitle>
        <EntityCardDescription>Orders placed with a supplier.</EntityCardDescription>
      </>,
    );

    expect(screen.getByRole("heading", { name: "Purchase orders" })).toHaveAttribute(
      "title",
      "Purchase orders",
    );
    expect(screen.getByText("Orders placed with a supplier.")).toHaveAttribute(
      "title",
      "Orders placed with a supplier.",
    );
  });
});
