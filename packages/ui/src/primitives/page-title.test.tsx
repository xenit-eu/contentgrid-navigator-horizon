import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageTitle } from "./page-title";

describe("PageTitle", () => {
  it("renders the title", () => {
    render(<PageTitle title="Invoices" />);
    expect(screen.getByText("Invoices")).toBeInTheDocument();
  });

  it("renders header when provided", () => {
    render(<PageTitle header="Entity Collection" title="Invoices" />);
    expect(screen.getByText("Entity Collection")).toBeInTheDocument();
  });

  it("does not render header when omitted", () => {
    const { container } = render(<PageTitle title="Invoices" />);
    expect(container.querySelector('[data-slot="page-title-header"]')).not.toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<PageTitle title="Invoices" subtitle="200 items" />);
    expect(screen.getByText("200 items")).toBeInTheDocument();
  });

  it("does not render subtitle when omitted", () => {
    const { container } = render(<PageTitle title="Invoices" />);
    expect(container.querySelector('[data-slot="page-title-subtitle"]')).not.toBeInTheDocument();
  });

  it("renders the icon slot", () => {
    render(<PageTitle title="Invoices" icon={<span data-testid="icon" />} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("defaults to the default size", () => {
    const { container } = render(<PageTitle title="Invoices" />);
    expect(container.querySelector('[data-slot="page-title"]')).toHaveAttribute(
      "data-size",
      "default",
    );
  });

  it("renders the title as an h1 at the default size", () => {
    render(<PageTitle title="Invoices" />);
    expect(screen.getByRole("heading", { level: 1, name: "Invoices" })).toBeInTheDocument();
  });

  it("renders the title as an h2 at the compact size", () => {
    render(<PageTitle title="Invoices" size="compact" />);
    expect(screen.getByRole("heading", { level: 2, name: "Invoices" })).toBeInTheDocument();
  });

  it("reflects the compact size on the root element", () => {
    const { container } = render(<PageTitle title="Invoices" size="compact" />);
    expect(container.querySelector('[data-slot="page-title"]')).toHaveAttribute(
      "data-size",
      "compact",
    );
  });
});
