import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconBadgeOptionPicker, IconBadgeOptionPickerList } from "./icon-badge-option-picker";

const INVOICE = { name: "invoice", title: "Invoice" };
const CUSTOMER = { name: "customer", title: "Customer" };
const SUPPLIER = { name: "supplier", title: "Supplier" };

describe("IconBadgeOptionPicker — selected option display", () => {
  it("shows the selected option title in the trigger", () => {
    render(
      <IconBadgeOptionPicker
        options={[INVOICE, CUSTOMER]}
        selectedOption={INVOICE}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Invoice")).toBeInTheDocument();
  });

  it("shows placeholder text when no option is selected", () => {
    render(<IconBadgeOptionPicker options={[INVOICE, CUSTOMER]} onSelect={vi.fn()} />);
    expect(screen.getByText("Select an option")).toBeInTheDocument();
  });

  it("shows the placeholder again when the parent clears a picked option", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <IconBadgeOptionPicker options={[INVOICE, CUSTOMER]} onSelect={vi.fn()} />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Customer" }));
    rerender(
      <IconBadgeOptionPicker
        options={[INVOICE, CUSTOMER]}
        selectedOption={CUSTOMER}
        onSelect={vi.fn()}
      />,
    );

    rerender(<IconBadgeOptionPicker options={[INVOICE, CUSTOMER]} onSelect={vi.fn()} />);

    expect(screen.getByRole("combobox")).toHaveTextContent("Select an option");
  });

  it("still renders when there is only one option", () => {
    render(<IconBadgeOptionPicker options={[INVOICE]} onSelect={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});

describe("IconBadgeOptionPicker — selection", () => {
  it("calls onSelect with the chosen option", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <IconBadgeOptionPicker
        options={[INVOICE, CUSTOMER, SUPPLIER]}
        selectedOption={INVOICE}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Customer" }));

    expect(onSelect).toHaveBeenCalledWith(CUSTOMER);
  });

  it("does not call onSelect when the selected option is chosen again", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <IconBadgeOptionPicker
        options={[INVOICE, CUSTOMER]}
        selectedOption={INVOICE}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Invoice" }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("IconBadgeOptionPicker — label prop", () => {
  it("renders the label text when label is provided", () => {
    render(
      <IconBadgeOptionPicker options={[INVOICE, CUSTOMER]} onSelect={vi.fn()} label="Entity" />,
    );
    expect(screen.getByText("Entity")).toBeInTheDocument();
  });

  it("associates the label with the trigger", () => {
    render(
      <IconBadgeOptionPicker options={[INVOICE, CUSTOMER]} onSelect={vi.fn()} label="Entity" />,
    );
    expect(screen.getByLabelText("Entity")).toBe(screen.getByRole("combobox"));
  });

  it("does not render label text when label is omitted", () => {
    render(<IconBadgeOptionPicker options={[INVOICE, CUSTOMER]} onSelect={vi.fn()} />);
    expect(screen.queryByText("Entity")).toBeNull();
  });
});

describe("IconBadgeOptionPicker — option content", () => {
  it("shows each option's description in its option row", async () => {
    const user = userEvent.setup();
    render(
      <IconBadgeOptionPicker
        options={[{ ...INVOICE, description: "A supplier invoice" }, CUSTOMER]}
        onSelect={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "Invoice" })).toHaveAccessibleDescription(
      "A supplier invoice",
    );
  });
});

describe("IconBadgeOptionPickerList", () => {
  it("marks only the selected option as checked", () => {
    render(
      <IconBadgeOptionPickerList
        options={[INVOICE, CUSTOMER]}
        selectedOption={CUSTOMER}
        onSelect={vi.fn()}
        label="Entity"
      />,
    );

    expect(screen.getByRole("radio", { name: "Customer" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Invoice" })).toHaveAttribute("aria-checked", "false");
  });

  it("shows each option's description in its row", () => {
    render(
      <IconBadgeOptionPickerList
        options={[{ ...INVOICE, description: "A supplier invoice" }, CUSTOMER]}
        onSelect={vi.fn()}
        label="Entity"
      />,
    );

    expect(screen.getByRole("radio", { name: /A supplier invoice/ })).toBeInTheDocument();
  });

  it("still renders when there is only one option", () => {
    render(<IconBadgeOptionPickerList options={[INVOICE]} onSelect={vi.fn()} label="Entity" />);
    expect(screen.getByRole("radio", { name: "Invoice" })).toBeInTheDocument();
  });

  it("calls onSelect with the clicked option", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <IconBadgeOptionPickerList
        options={[INVOICE, CUSTOMER]}
        selectedOption={INVOICE}
        onSelect={onSelect}
        label="Entity"
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Customer" }));

    expect(onSelect).toHaveBeenCalledWith(CUSTOMER);
  });

  it("puts only the selected option in the tab order", async () => {
    const user = userEvent.setup();
    render(
      <IconBadgeOptionPickerList
        options={[INVOICE, CUSTOMER, SUPPLIER]}
        selectedOption={CUSTOMER}
        onSelect={vi.fn()}
        label="Entity"
      />,
    );

    await user.tab();
    expect(screen.getByRole("radio", { name: "Customer" })).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it("puts the first option in the tab order when nothing is selected", async () => {
    const user = userEvent.setup();
    render(
      <IconBadgeOptionPickerList options={[INVOICE, CUSTOMER]} onSelect={vi.fn()} label="Entity" />,
    );

    await user.tab();

    expect(screen.getByRole("radio", { name: "Invoice" })).toHaveFocus();
  });

  it("moves focus to and selects the next option with the arrow keys, wrapping at the ends", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <IconBadgeOptionPickerList
        options={[INVOICE, CUSTOMER, SUPPLIER]}
        selectedOption={SUPPLIER}
        onSelect={onSelect}
        label="Entity"
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: "Invoice" })).toHaveFocus();
    expect(onSelect).toHaveBeenCalledWith(INVOICE);
  });

  it("moves focus to and selects the previous option with the arrow keys", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <IconBadgeOptionPickerList
        options={[INVOICE, CUSTOMER, SUPPLIER]}
        selectedOption={CUSTOMER}
        onSelect={onSelect}
        label="Entity"
      />,
    );

    await user.tab();
    await user.keyboard("{ArrowUp}");

    expect(screen.getByRole("radio", { name: "Invoice" })).toHaveFocus();
    expect(onSelect).toHaveBeenCalledWith(INVOICE);
  });
});
