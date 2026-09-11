import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconPicker } from "./icon-picker";

describe("IconPicker", () => {
  it("shows a placeholder when no icon is selected", () => {
    render(<IconPicker value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText("Choose icon")).toBeInTheDocument();
  });

  it("shows the selected icon's name", () => {
    render(<IconPicker value="Database" onChange={vi.fn()} />);
    expect(screen.getByText("Database")).toBeInTheDocument();
  });

  it("does not show the icon grid until the trigger is clicked", () => {
    render(<IconPicker value={undefined} onChange={vi.fn()} />);
    expect(screen.queryByTitle("Folder")).not.toBeInTheDocument();
  });

  it("calls onChange with the icon name when an option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /choose icon/i }));
    await user.click(screen.getByTitle("Folder"));

    expect(onChange).toHaveBeenCalledWith("Folder");
  });

  it("filters the icon grid by the search input", async () => {
    const user = userEvent.setup();
    render(<IconPicker value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /choose icon/i }));
    await user.type(screen.getByPlaceholderText("Search icons…"), "data");

    expect(screen.getByTitle("Database")).toBeInTheDocument();
    expect(screen.queryByTitle("Folder")).not.toBeInTheDocument();
  });

  it("shows a no-results message when the search matches nothing", async () => {
    const user = userEvent.setup();
    render(<IconPicker value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /choose icon/i }));
    await user.type(screen.getByPlaceholderText("Search icons…"), "zzzzzz");

    expect(screen.getByText("No icons found")).toBeInTheDocument();
  });

  it("filters the icon grid to icons tagged with a selected category", async () => {
    const user = userEvent.setup();
    render(<IconPicker value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /choose icon/i }));
    await user.click(screen.getByText("Shapes"));

    expect(screen.getByTitle("Cube")).toBeInTheDocument();
    expect(screen.queryByTitle("Waveform")).not.toBeInTheDocument();
  });

  it("unions icons across more than one selected category", async () => {
    const user = userEvent.setup();
    render(<IconPicker value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /choose icon/i }));
    await user.click(screen.getByText("Shapes"));
    await user.click(screen.getByText("Persons"));

    expect(screen.getByTitle("Cube")).toBeInTheDocument();
    expect(screen.getByTitle("Users")).toBeInTheDocument();
    expect(screen.queryByTitle("Briefcase")).not.toBeInTheDocument();
  });

  it("deselecting a category restores the icons it had filtered out", async () => {
    const user = userEvent.setup();
    render(<IconPicker value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /choose icon/i }));
    const shapesChip = screen.getByText("Shapes");
    await user.click(shapesChip);
    expect(screen.queryByTitle("Briefcase")).not.toBeInTheDocument();

    await user.click(shapesChip);
    expect(screen.getByTitle("Briefcase")).toBeInTheDocument();
  });

  it("combines an active category filter with the search text", async () => {
    const user = userEvent.setup();
    render(<IconPicker value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /choose icon/i }));
    await user.click(screen.getByText("Persons"));
    await user.type(screen.getByPlaceholderText("Search icons…"), "square");

    // UserSquare is tagged Persons+Shapes and matches the search; CheckSquare also matches
    // the search text but is Shapes-only, so the Persons category filter excludes it.
    expect(screen.getByTitle("UserSquare")).toBeInTheDocument();
    expect(screen.queryByTitle("CheckSquare")).not.toBeInTheDocument();
  });
});
