import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntitySelector } from "./entity-selector";
import type { Entity } from "./entity-selector";

const INVOICE: Entity = { name: "invoice", title: "Invoice" };
const CUSTOMER: Entity = { name: "customer", title: "Customer" };
const SUPPLIER: Entity = { name: "supplier", title: "Supplier" };

describe("EntitySelector — visibility", () => {
  it("renders nothing when entities list is empty", () => {
    const { container } = render(<EntitySelector entities={[]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when only one entity is available", () => {
    const { container } = render(<EntitySelector entities={[INVOICE]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the select trigger when exactly two entities are available", () => {
    render(<EntitySelector entities={[INVOICE, CUSTOMER]} onSelect={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders the select trigger when three or more entities are available", () => {
    render(<EntitySelector entities={[INVOICE, CUSTOMER, SUPPLIER]} onSelect={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});

describe("EntitySelector — selected entity display", () => {
  it("shows the selected entity title in the trigger", () => {
    render(
      <EntitySelector entities={[INVOICE, CUSTOMER]} selectedEntity={INVOICE} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("Invoice")).toBeInTheDocument();
  });

  it("shows placeholder text when no entity is selected", () => {
    render(<EntitySelector entities={[INVOICE, CUSTOMER]} onSelect={vi.fn()} />);
    expect(screen.getByText("Select entity")).toBeInTheDocument();
  });
});

describe("EntitySelector — label prop", () => {
  it("renders the label text when label is provided", () => {
    render(<EntitySelector entities={[INVOICE, CUSTOMER]} onSelect={vi.fn()} label="Entity" />);
    expect(screen.getByText("Entity")).toBeInTheDocument();
  });

  it("does not render label text when label is omitted", () => {
    render(<EntitySelector entities={[INVOICE, CUSTOMER]} onSelect={vi.fn()} />);
    expect(screen.queryByText("Entity")).toBeNull();
  });
});

describe("EntitySelector — entity switch", () => {
  it("calls onSelect with the chosen entity when the user picks one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <EntitySelector
        entities={[INVOICE, CUSTOMER, SUPPLIER]}
        selectedEntity={INVOICE}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Customer" }));

    expect(onSelect).toHaveBeenCalledWith(CUSTOMER);
  });

  it("does not call onSelect when the already-selected entity is chosen again", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <EntitySelector
        entities={[INVOICE, CUSTOMER]}
        selectedEntity={INVOICE}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    // Radix Select suppresses onChange when the same value is selected
    await user.click(screen.getByRole("option", { name: "Invoice" }));

    expect(onSelect).toHaveBeenCalledTimes(0);
  });

  it("lists all entity titles as options", async () => {
    const user = userEvent.setup();
    render(
      <EntitySelector
        entities={[INVOICE, CUSTOMER, SUPPLIER]}
        selectedEntity={INVOICE}
        onSelect={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "Invoice" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Customer" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Supplier" })).toBeInTheDocument();
  });
});
