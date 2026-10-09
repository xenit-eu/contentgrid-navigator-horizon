import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconBadgeOptionPicker, IconBadgeOptionPickerList } from "./icon-badge-option-picker";

const INVOICE = { name: "invoice", title: "Invoice" };
const CUSTOMER = { name: "customer", title: "Customer" };

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
});

describe("IconBadgeOptionPicker — label prop", () => {
  it("renders the label text when label is provided", () => {
    render(
      <IconBadgeOptionPicker options={[INVOICE, CUSTOMER]} onSelect={vi.fn()} label="Entity" />,
    );
    expect(screen.getByText("Entity")).toBeInTheDocument();
  });

  it("names the trigger after the label", () => {
    render(
      <IconBadgeOptionPicker options={[INVOICE, CUSTOMER]} onSelect={vi.fn()} label="Entity" />,
    );
    expect(screen.getByRole("combobox", { name: "Entity" })).toBeInTheDocument();
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

    expect(screen.getByText("A supplier invoice")).toBeInTheDocument();
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
});
