import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EnumMultiRenderer } from "./enum-multi-renderer";
import { enumMultiField } from "./test-fixtures";

async function openList() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "Tags" }));
  return { user, listbox: await screen.findByRole("listbox") };
}

describe("EnumMultiRenderer", () => {
  it("shows a placeholder when nothing is selected", () => {
    render(<EnumMultiRenderer {...enumMultiField()} value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Tags" })).toHaveTextContent("Select…");
  });

  it("shows the selected values as chips in the trigger, by label", () => {
    render(
      <EnumMultiRenderer {...enumMultiField()} value={["draft", "archived"]} onChange={vi.fn()} />,
    );
    const trigger = screen.getByRole("combobox", { name: "Tags" });
    expect(within(trigger).getByText("Draft")).toBeInTheDocument();
    expect(within(trigger).getByText("Archived")).toBeInTheDocument();
    expect(within(trigger).queryByText("Published")).not.toBeInTheDocument();
  });

  it("shows a selected value that is not an option by its raw value", () => {
    render(<EnumMultiRenderer {...enumMultiField()} value={["legacy"]} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Tags" })).toHaveTextContent("legacy");
  });

  it("lists every option and marks the selected ones", async () => {
    render(<EnumMultiRenderer {...enumMultiField()} value={["draft"]} onChange={vi.fn()} />);
    const { listbox } = await openList();
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(within(listbox).getByRole("option", { name: "Draft" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(listbox).getByRole("option", { name: "Published" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("adds an option when picked, and keeps the list open", async () => {
    const onChange = vi.fn();
    render(<EnumMultiRenderer {...enumMultiField()} value={["draft"]} onChange={onChange} />);
    const { user, listbox } = await openList();
    await user.click(within(listbox).getByRole("option", { name: "Published" }));
    expect(onChange).toHaveBeenCalledWith(["draft", "published"]);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("removes a selected option when picked again", async () => {
    const onChange = vi.fn();
    render(
      <EnumMultiRenderer
        {...enumMultiField()}
        value={["draft", "published"]}
        onChange={onChange}
      />,
    );
    const { user, listbox } = await openList();
    await user.click(within(listbox).getByRole("option", { name: "Draft" }));
    expect(onChange).toHaveBeenCalledWith(["published"]);
  });

  it("narrows the list by the option label as you type", async () => {
    render(<EnumMultiRenderer {...enumMultiField()} value={[]} onChange={vi.fn()} />);
    const { user, listbox } = await openList();
    await user.type(screen.getByRole("combobox", { name: "Search Tags" }), "Arch");
    expect(within(listbox).getAllByRole("option")).toHaveLength(1);
    expect(within(listbox).getByRole("option", { name: "Archived" })).toBeInTheDocument();
  });

  it("disables unselected options once maxItems is reached", async () => {
    render(
      <EnumMultiRenderer
        {...enumMultiField({ maxItems: 1 })}
        value={["draft"]}
        onChange={vi.fn()}
      />,
    );
    const { listbox } = await openList();
    expect(within(listbox).getByRole("option", { name: "Published" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(listbox).getByRole("option", { name: "Draft" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });

  it("disables the trigger when read-only", () => {
    render(
      <EnumMultiRenderer {...enumMultiField({ readOnly: true })} value={[]} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("combobox", { name: "Tags" })).toBeDisabled();
  });

  it("marks the trigger invalid and points it at the error", () => {
    render(
      <EnumMultiRenderer
        {...enumMultiField({ error: "Tags is required" })}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Tags" });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", "tags-error");
  });

  it("shows a not-yet-loaded message and no combobox for a remote options source", () => {
    render(
      <EnumMultiRenderer
        {...enumMultiField({ options: [], isRemote: true })}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Options not yet loaded")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
