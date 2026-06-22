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

  it("renders with neutral tone by default without throwing", () => {
    const { container } = render(<Chip label="Tag" />);
    expect(container.querySelector("[data-slot='chip']")).toBeInTheDocument();
  });

  it("renders with applied tone without throwing", () => {
    const { container } = render(<Chip label="Tag" tone="applied" />);
    expect(container.querySelector("[data-slot='chip']")).toBeInTheDocument();
  });
});
