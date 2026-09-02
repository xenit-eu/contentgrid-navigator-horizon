import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProfileAttributeOption } from "./attribute-selector";
import { AttributeMultiSelect, AttributeSelect } from "./attribute-selector";

const NAME: ProfileAttributeOption = {
  name: "name",
  title: "Name",
  description: "The display name",
  type: "string",
};
const AMOUNT: ProfileAttributeOption = {
  name: "amount",
  title: "Amount",
  description: "Total amount",
  type: "long",
};
const CREATED_DATE: ProfileAttributeOption = {
  name: "createdDate",
  title: "Created date",
  description: "When this record was created",
  type: "datetime",
  isSystem: true,
};
const CREATED_BY: ProfileAttributeOption = {
  name: "createdBy",
  title: "Created by",
  description: "Who created this record",
  type: "string",
  isSystem: true,
};

const ATTRIBUTES = [NAME, AMOUNT, CREATED_DATE, CREATED_BY];

describe("AttributeSelect", () => {
  it("renders a placeholder when nothing is selected", () => {
    render(<AttributeSelect attributes={ATTRIBUTES} onSelect={vi.fn()} />);
    expect(screen.getByText("Select attribute")).toBeInTheDocument();
  });

  it("shows the selected attribute title in the trigger", () => {
    render(<AttributeSelect attributes={ATTRIBUTES} value="amount" onSelect={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Amount");
  });

  it("does not show the type badge or description in the trigger, only icon and name", () => {
    render(<AttributeSelect attributes={ATTRIBUTES} value="amount" onSelect={vi.fn()} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Amount");
    expect(within(trigger).queryByText("long")).toBeNull();
    expect(within(trigger).queryByText("Total amount")).toBeNull();
  });

  it("lists regular attributes and system attributes in separate groups", async () => {
    const user = userEvent.setup();
    render(<AttributeSelect attributes={ATTRIBUTES} onSelect={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Amount/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Created date/ })).toBeInTheDocument();
    expect(screen.getByText("System attributes")).toBeInTheDocument();
  });

  it("shows the attribute type and description for each option", async () => {
    const user = userEvent.setup();
    render(<AttributeSelect attributes={ATTRIBUTES} onSelect={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    const option = screen.getByRole("option", { name: /Amount/ });
    expect(within(option).getByText("long")).toBeInTheDocument();
    expect(within(option).getByText("Total amount")).toBeInTheDocument();
  });

  it("calls onSelect with the chosen attribute", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AttributeSelect attributes={ATTRIBUTES} onSelect={onSelect} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /Amount/ }));

    expect(onSelect).toHaveBeenCalledWith(AMOUNT);
  });

  it("does not render a system attributes group when there are none", async () => {
    const user = userEvent.setup();
    render(<AttributeSelect attributes={[NAME, AMOUNT]} onSelect={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    expect(screen.queryByText("System attributes")).toBeNull();
  });

  it("renders the label text when provided", () => {
    render(<AttributeSelect attributes={ATTRIBUTES} onSelect={vi.fn()} label="Sort by" />);
    expect(screen.getByText("Sort by")).toBeInTheDocument();
  });
});

describe("AttributeMultiSelect", () => {
  it("shows a placeholder when nothing is selected", () => {
    render(<AttributeMultiSelect attributes={ATTRIBUTES} values={[]} onChange={vi.fn()} />);
    expect(screen.getByText("Select attributes")).toBeInTheDocument();
  });

  it("shows the single selected attribute's title in the trigger", () => {
    render(<AttributeMultiSelect attributes={ATTRIBUTES} values={["amount"]} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Amount");
  });

  it("shows a count when multiple attributes are selected", () => {
    render(
      <AttributeMultiSelect
        attributes={ATTRIBUTES}
        values={["name", "amount"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("2 attributes selected");
  });

  it("lists regular attributes and system attributes in separate groups", async () => {
    const user = userEvent.setup();
    render(<AttributeMultiSelect attributes={ATTRIBUTES} values={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("System attributes")).toBeInTheDocument();
    expect(screen.getByText("Created date")).toBeInTheDocument();
  });

  it("calls onChange with the attribute added when an unselected option is toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AttributeMultiSelect attributes={ATTRIBUTES} values={["name"]} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("checkbox", { name: /Amount/ }));

    expect(onChange).toHaveBeenCalledWith(["name", "amount"]);
  });

  it("calls onChange with the attribute removed when a selected option is toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AttributeMultiSelect
        attributes={ATTRIBUTES}
        values={["name", "amount"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("checkbox", { name: /Amount/ }));

    expect(onChange).toHaveBeenCalledWith(["name"]);
  });

  it("renders the label text when provided", () => {
    render(
      <AttributeMultiSelect
        attributes={ATTRIBUTES}
        values={[]}
        onChange={vi.fn()}
        label="Columns"
      />,
    );
    expect(screen.getByText("Columns")).toBeInTheDocument();
  });
});
