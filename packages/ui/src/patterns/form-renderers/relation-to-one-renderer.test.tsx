import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RelationToOneRenderer } from "./relation-to-one-renderer";
import { relationToOneField } from "./test-fixtures";

describe("RelationToOneRenderer", () => {
  it("shows 'No item linked' and a Link button when value is empty", () => {
    render(<RelationToOneRenderer {...relationToOneField()} value="" onChange={vi.fn()} />);
    expect(screen.getByText("No item linked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument();
  });

  it("hides the Link button when onLink is not provided, even though it isn't readOnly", () => {
    render(
      <RelationToOneRenderer
        {...relationToOneField({ onLink: undefined })}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Link" })).not.toBeInTheDocument();
  });

  it("hides the Change button (but keeps Unlink) when onLink is not provided for a linked item", () => {
    render(
      <RelationToOneRenderer
        {...relationToOneField({ onLink: undefined })}
        value="https://api.example.com/suppliers/1"
        onChange={vi.fn()}
        linkedItem={<span>Acme Corp</span>}
      />,
    );
    expect(screen.queryByRole("button", { name: "Change" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlink" })).toBeInTheDocument();
  });

  it("shows a skeleton instead of the linked-item summary while isLoading", () => {
    const { container } = render(
      <RelationToOneRenderer
        {...relationToOneField()}
        value="https://api.example.com/suppliers/1"
        onChange={vi.fn()}
        isLoading
      />,
    );
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    expect(screen.queryByText("No item linked")).not.toBeInTheDocument();
  });

  it("renders the linkedItem summary with Change and Unlink actions once loaded", () => {
    render(
      <RelationToOneRenderer
        {...relationToOneField()}
        value="https://api.example.com/suppliers/1"
        onChange={vi.fn()}
        linkedItem={<span>Acme Corp</span>}
      />,
    );
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlink" })).toBeInTheDocument();
  });

  it("clears the value via onChange when Unlink is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RelationToOneRenderer
        {...relationToOneField()}
        value="https://api.example.com/suppliers/1"
        onChange={onChange}
        linkedItem={<span>Acme Corp</span>}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("keeps Details but hides Change/Unlink when readOnly and linked", () => {
    render(
      <RelationToOneRenderer
        {...relationToOneField({ readOnly: true, onViewDetails: vi.fn() })}
        value="https://api.example.com/suppliers/1"
        onChange={vi.fn()}
        linkedItem={<span>Acme Corp</span>}
      />,
    );
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlink" })).not.toBeInTheDocument();
  });

  it("hides the Link button when readOnly and unlinked", () => {
    render(
      <RelationToOneRenderer
        {...relationToOneField({ readOnly: true })}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Link" })).not.toBeInTheDocument();
  });

  it("renders the error message when provided", () => {
    render(
      <RelationToOneRenderer
        {...relationToOneField({ error: "Supplier is required" })}
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Supplier is required")).toBeInTheDocument();
  });
});
