import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelationSection } from "./relation-section";

function renderRelation(overrides: Partial<Parameters<typeof RelationSection>[0]> = {}) {
  return render(<RelationSection title="Invoices" {...overrides} />);
}

describe("RelationSection", () => {
  it("renders the title", () => {
    renderRelation();
    expect(screen.getAllByText("Invoices")[0]).toBeInTheDocument();
  });

  it("renders a required marker when required is true", () => {
    renderRelation({ required: true });
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders children when provided", () => {
    renderRelation({ children: <p>Custom content</p> });
    expect(screen.getByText("Custom content")).toBeInTheDocument();
  });

  it("shows the empty-state prompt when no children are given", () => {
    renderRelation();
    expect(screen.getByText("No invoices linked")).toBeInTheDocument();
  });

  it("does not show the empty-state prompt when children are given", () => {
    renderRelation({ children: <p>Custom content</p> });
    expect(screen.queryByText("No invoices linked")).not.toBeInTheDocument();
  });

  it("shows a Link button in the empty state when onLink is provided", () => {
    renderRelation({ onLink: vi.fn() });
    expect(screen.getByRole("button", { name: /link invoices/i })).toBeInTheDocument();
  });

  it("does not show a Link button in the empty state when onLink is absent", () => {
    renderRelation();
    expect(screen.queryByRole("button", { name: /link/i })).not.toBeInTheDocument();
  });

  it("shows a header Link button when children and onLink are both provided", () => {
    renderRelation({ children: <p>Custom content</p>, onLink: vi.fn() });
    expect(screen.getByRole("button", { name: /link invoices/i })).toBeInTheDocument();
  });

  it("does not show a header Link button when children are provided but onLink is absent", () => {
    renderRelation({ children: <p>Custom content</p> });
    expect(screen.queryByRole("button", { name: /link/i })).not.toBeInTheDocument();
  });
});
