import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getRecordTableGridTemplate } from "./grid-template";
import { RecordTableRow } from "./table-row";
import type { RecordTableCell } from "./table-row";

const CELLS: RecordTableCell[] = [
  { key: "reference", content: "INV-2024-001" },
  { key: "supplier", content: "Acme Corp" },
  { key: "total", content: "€1,234.56", align: "end" },
];

describe("RecordTableRow", () => {
  it("renders each cell's content", () => {
    render(<RecordTableRow cells={CELLS} />);
    expect(screen.getByText("INV-2024-001")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("€1,234.56")).toBeInTheDocument();
  });

  it("right-aligns a cell with align: end", () => {
    render(<RecordTableRow cells={CELLS} />);
    const totalCell = screen.getByText("€1,234.56");
    expect(totalCell.className).toContain("text-right");
  });

  it("does not right-align a cell without align: end", () => {
    render(<RecordTableRow cells={CELLS} />);
    const supplierCell = screen.getByText("Acme Corp");
    expect(supplierCell.className).not.toContain("text-right");
  });

  it("calls onClick when the row is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<RecordTableRow cells={CELLS} onClick={onClick} />);
    await user.click(screen.getByRole("row"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not throw when clicked without onClick handler", async () => {
    const user = userEvent.setup();
    render(<RecordTableRow cells={CELLS} />);
    await user.click(screen.getByRole("row"));
  });

  it("renders selected indicator (accent bar) when selected=true", () => {
    const { container } = render(<RecordTableRow cells={CELLS} selected />);
    const accent = container.querySelector("span[aria-hidden='true'].absolute");
    expect(accent).toBeInTheDocument();
  });

  it("does not render selected indicator when selected=false", () => {
    const { container } = render(<RecordTableRow cells={CELLS} selected={false} />);
    const accent = container.querySelector("span[aria-hidden='true'].absolute");
    expect(accent).not.toBeInTheDocument();
  });

  it("has role=row", () => {
    render(<RecordTableRow cells={CELLS} />);
    expect(screen.getByRole("row")).toBeInTheDocument();
  });

  it("does not render an actions cell when actions is absent", () => {
    render(<RecordTableRow cells={CELLS} />);
    expect(screen.getAllByRole("cell")).toHaveLength(CELLS.length);
  });

  it("renders actions in a trailing cell when provided", () => {
    render(<RecordTableRow cells={CELLS} actions={<button type="button">Delete</button>} />);
    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(CELLS.length + 1);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("sizes the grid template for cells.length tracks when actions is absent", () => {
    const { container } = render(<RecordTableRow cells={CELLS} />);
    const row = container.querySelector('[role="row"]') as HTMLElement;
    expect(row.style.gridTemplateColumns).toBe(
      getRecordTableGridTemplate(CELLS.length, { hasActions: false }),
    );
  });

  it("sizes the grid template for cells.length + 1 tracks when actions is present", () => {
    const { container } = render(
      <RecordTableRow cells={CELLS} actions={<button type="button">Delete</button>} />,
    );
    const row = container.querySelector('[role="row"]') as HTMLElement;
    expect(row.style.gridTemplateColumns).toBe(
      getRecordTableGridTemplate(CELLS.length, { hasActions: true }),
    );
  });
});
