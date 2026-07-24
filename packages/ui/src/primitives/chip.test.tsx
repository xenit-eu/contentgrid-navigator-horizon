import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Chip } from "./chip";

describe("Chip", () => {
  it("renders label text", () => {
    render(<Chip label="Finance" />);
    expect(screen.getByText("Finance")).toBeInTheDocument();
  });

  it("renders field prefix when field prop is provided", () => {
    render(<Chip label="Active" field="Status" />);
    expect(screen.getByText(/Status:/)).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows remove button when removable is true and onRemove is provided", () => {
    render(<Chip label="Finance" removable onRemove={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Remove Finance filter" })).toBeInTheDocument();
  });

  it("does not show remove button when removable is false", () => {
    render(<Chip label="Finance" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("clicking remove button calls onRemove", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Chip label="Finance" removable onRemove={onRemove} />);
    await user.click(screen.getByRole("button", { name: "Remove Finance filter" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("renders with neutral tone's background/border classes by default", () => {
    const { container } = render(<Chip label="Tag" />);
    const chip = container.querySelector("[data-slot='chip']");
    expect(chip?.className).toContain("bg-[#FAFDFF]");
    expect(chip?.className).toContain("border-[#E3EAF0]");
    expect(chip?.className).not.toContain("bg-[#E2F3FD]");
  });

  it("renders with applied tone's background/border classes", () => {
    const { container } = render(<Chip label="Tag" tone="applied" />);
    const chip = container.querySelector("[data-slot='chip']");
    expect(chip?.className).toContain("bg-[#E2F3FD]");
    expect(chip?.className).toContain("border-[#C4E6F9]");
    expect(chip?.className).not.toContain("bg-[#FAFDFF]");
  });
});
