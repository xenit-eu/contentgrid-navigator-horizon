import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GroupedSelect, type GroupedSelectGroup } from "./grouped-select";

const groups: GroupedSelectGroup[] = [
  {
    id: "modes",
    options: [
      { value: "all", label: "All" },
      { value: "all-direct", label: "All except relations" },
    ],
  },
  {
    id: "self",
    label: "Invoice",
    options: [
      {
        value: "title",
        label: "Title",
        hint: "Starts with",
        icon: <span data-testid="icon-title" />,
      },
      { value: "quantity", label: "Quantity", hint: "Integer" },
    ],
  },
  {
    id: "customer",
    label: "Customer",
    options: [{ value: "customer.name", label: "Name", hint: "Starts with" }],
  },
];

describe("GroupedSelect", () => {
  it("shows the selected option's icon, label and hint in the trigger", () => {
    render(
      <GroupedSelect
        value="title"
        onValueChange={vi.fn()}
        groups={groups}
        triggerLabel="Search in"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Search in" });
    expect(trigger).toHaveTextContent("TitleStarts with");
    expect(within(trigger).getByTestId("icon-title")).toBeInTheDocument();
  });

  it("hides the label (not the icon) in compact mode", () => {
    render(<GroupedSelect value="title" onValueChange={vi.fn()} groups={groups} compact />);
    expect(screen.getByText("Title")).toHaveClass("sr-only");
    expect(screen.queryByText("Starts with")).not.toBeInTheDocument();
  });

  it("hides the label only on narrow screens with compact='below-sm'", () => {
    render(
      <GroupedSelect value="title" onValueChange={vi.fn()} groups={groups} compact="below-sm" />,
    );
    expect(screen.getByText("Title")).toHaveClass("max-sm:sr-only");
    expect(screen.getByText("Starts with")).toHaveClass("max-sm:hidden");
  });

  it("lists groups with headers and hints, and reports the picked value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <GroupedSelect
        value="all"
        onValueChange={onValueChange}
        groups={groups}
        triggerLabel="Search in"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Search in" }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByText("Invoice")).toBeInTheDocument();
    expect(within(listbox).getByText("Customer")).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: /Quantity/ })).toHaveTextContent(
      "QuantityInteger",
    );

    await user.click(within(listbox).getByRole("option", { name: /Name/ }));
    expect(onValueChange).toHaveBeenCalledWith("customer.name");
  });

  it("can be operated with the keyboard", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <GroupedSelect
        value="all"
        onValueChange={onValueChange}
        groups={groups}
        triggerLabel="Search in"
      />,
    );
    screen.getByRole("combobox", { name: "Search in" }).focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("all-direct");
  });
});
