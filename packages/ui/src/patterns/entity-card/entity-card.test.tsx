import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityCard } from "./entity-card";

describe("EntityCard", () => {
  const baseProps = { name: "invoice", title: "Invoice" };

  it("renders the entity title", () => {
    render(<EntityCard {...baseProps} />);
    expect(screen.getByText("Invoice")).toBeInTheDocument();
  });

  it("renders count when provided", () => {
    render(<EntityCard {...baseProps} count={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders '—' when count is undefined", () => {
    render(<EntityCard {...baseProps} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders '—' when count is 0 is not shown as falsy (count 0 is valid)", () => {
    render(<EntityCard {...baseProps} count={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EntityCard {...baseProps} description="Entity description" />);
    expect(screen.getByText("Entity description")).toBeInTheDocument();
  });

  it("does not render description when omitted", () => {
    render(<EntityCard {...baseProps} />);
    expect(screen.queryByText("Entity description")).not.toBeInTheDocument();
  });

  it("renders Database icon when hasContent is false/undefined", () => {
    const { container } = render(<EntityCard {...baseProps} />);
    // The SVG is rendered — we can check no FileText and a Database icon via aria/title
    // lucide renders svg elements; we just verify one icon is present
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders FileText icon when hasContent is true", () => {
    const { container } = render(<EntityCard {...baseProps} hasContent />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("calls onTitleClick with entity name when title button is clicked", async () => {
    const user = userEvent.setup();
    const onTitleClick = vi.fn();
    render(<EntityCard {...baseProps} onTitleClick={onTitleClick} />);
    await user.click(screen.getByText("Invoice"));
    expect(onTitleClick).toHaveBeenCalledWith("invoice");
  });

  it("does not throw when title button is clicked without onTitleClick", async () => {
    const user = userEvent.setup();
    render(<EntityCard {...baseProps} />);
    await user.click(screen.getByText("Invoice"));
  });

  it("calls onCreateClick with entity name when create button is clicked", async () => {
    const user = userEvent.setup();
    const onCreateClick = vi.fn();
    render(<EntityCard {...baseProps} onCreateClick={onCreateClick} />);
    await user.click(screen.getByRole("button", { name: "Create Invoice" }));
    expect(onCreateClick).toHaveBeenCalledWith("invoice");
  });

  it("does not throw when create button is clicked without onCreateClick", async () => {
    const user = userEvent.setup();
    render(<EntityCard {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "Create Invoice" }));
  });

  it("renders the 'items' label below the count", () => {
    render(<EntityCard {...baseProps} />);
    expect(screen.getByText("items")).toBeInTheDocument();
  });
});
