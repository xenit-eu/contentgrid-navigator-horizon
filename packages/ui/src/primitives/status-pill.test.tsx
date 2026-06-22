import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "./status-pill";

describe("StatusPill", () => {
  it("renders label text", () => {
    render(<StatusPill label="Approved" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("renders SVG icon by default", () => {
    const { container } = render(<StatusPill label="Approved" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders success status without throwing", () => {
    const { container } = render(<StatusPill status="success" label="Approved" />);
    expect(container.querySelector("[data-slot='status-pill']")).toBeInTheDocument();
  });

  it("renders danger status without throwing", () => {
    const { container } = render(<StatusPill status="danger" label="Rejected" />);
    expect(container.querySelector("[data-slot='status-pill']")).toBeInTheDocument();
  });

  it("renders warning status without throwing", () => {
    const { container } = render(<StatusPill status="warning" label="Pending" />);
    expect(container.querySelector("[data-slot='status-pill']")).toBeInTheDocument();
  });

  it("renders neutral status (default) without throwing", () => {
    const { container } = render(<StatusPill status="neutral" label="Draft" />);
    expect(container.querySelector("[data-slot='status-pill']")).toBeInTheDocument();
  });

  it("uses neutral as default status when status prop is omitted", () => {
    const { container } = render(<StatusPill label="Unknown" />);
    // neutral uses CircleIcon — SVG should be present
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders custom icon when icon prop is provided", () => {
    const { container } = render(
      <StatusPill status="success" label="Featured" icon={<span data-testid="star" />} />,
    );
    expect(container.querySelector("[data-testid='star']")).toBeInTheDocument();
  });
});
