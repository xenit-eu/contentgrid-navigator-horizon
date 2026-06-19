import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchField } from "./search-field";

describe("SearchField", () => {
  it("renders input with default placeholder", () => {
    render(<SearchField />);
    expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
  });

  it("renders input with custom placeholder", () => {
    render(<SearchField placeholder="Find something…" />);
    expect(screen.getByPlaceholderText("Find something…")).toBeInTheDocument();
  });

  it("renders magnifying glass icon SVG", () => {
    const { container } = render(<SearchField />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders chips when provided", () => {
    render(<SearchField chips={[{ field: "Status", label: "Active" }]} />);
    expect(screen.getByText("Status:")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows remove button on chip when onRemoveChip is provided", () => {
    render(<SearchField chips={[{ field: "Status", label: "Active" }]} onRemoveChip={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Remove Active filter" })).toBeInTheDocument();
  });

  it("calling remove chip button fires onRemoveChip with correct index", async () => {
    const user = userEvent.setup();
    const onRemoveChip = vi.fn();
    render(
      <SearchField chips={[{ field: "Status", label: "Active" }]} onRemoveChip={onRemoveChip} />,
    );
    await user.click(screen.getByRole("button", { name: "Remove Active filter" }));
    expect(onRemoveChip).toHaveBeenCalledWith(0);
  });

  it("does not show remove button when onRemoveChip is omitted", () => {
    render(<SearchField chips={[{ field: "Status", label: "Active" }]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("controlled: value prop shows in input", () => {
    render(<SearchField value="hello" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });

  it("calls onChange when typing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchField value="" onChange={onChange} />);
    await user.type(screen.getByRole("searchbox"), "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("applies focused styling class when focused prop is true", () => {
    const { container } = render(<SearchField focused />);
    const wrapper = container.querySelector("[data-slot='search-field']");
    expect(wrapper?.className).toContain("ring-[3px]");
  });
});
