import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecordTableRow } from "./table-row";

describe("RecordTableRow", () => {
  it("renders reference text", () => {
    render(<RecordTableRow reference="INV-2024-001" />);
    expect(screen.getByText("INV-2024-001")).toBeInTheDocument();
  });

  it("renders supplier text", () => {
    render(<RecordTableRow supplier="Acme Corp" />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("renders total text", () => {
    render(<RecordTableRow total="€1,234.56" />);
    expect(screen.getByText("€1,234.56")).toBeInTheDocument();
  });

  it("renders fileMeta text", () => {
    render(<RecordTableRow fileMeta="invoice.pdf · 234 KB" />);
    expect(screen.getByText("invoice.pdf · 234 KB")).toBeInTheDocument();
  });

  it("calls onClick when the row is clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<RecordTableRow reference="INV-001" onClick={onClick} />);
    await user.click(screen.getByRole("row"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not throw when clicked without onClick handler", async () => {
    const user = userEvent.setup();
    render(<RecordTableRow reference="INV-001" />);
    await user.click(screen.getByRole("row"));
  });

  it("renders selected indicator (accent bar) when selected=true", () => {
    const { container } = render(<RecordTableRow selected />);
    // The accent bar is a span with aria-hidden and a fixed-width class
    const accent = container.querySelector("span[aria-hidden='true'].absolute");
    expect(accent).toBeInTheDocument();
  });

  it("does not render selected indicator when selected=false", () => {
    const { container } = render(<RecordTableRow selected={false} />);
    const accent = container.querySelector("span[aria-hidden='true'].absolute");
    expect(accent).not.toBeInTheDocument();
  });

  it("renders FileIcon for each fileType", () => {
    const types = ["pdf", "img", "doc"] as const;
    for (const type of types) {
      const { container, unmount } = render(<RecordTableRow fileType={type} />);
      expect(container.querySelector("svg")).toBeInTheDocument();
      unmount();
    }
  });

  it("has role=row", () => {
    render(<RecordTableRow />);
    expect(screen.getByRole("row")).toBeInTheDocument();
  });
});
