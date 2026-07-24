import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "./status-pill";

describe("StatusPill", () => {
  it("renders label text", () => {
    render(<StatusPill label="Approved" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("uses neutral as default status when status prop is omitted, rendering an icon", () => {
    const { container } = render(<StatusPill label="Unknown" />);
    // neutral uses CircleIcon — SVG should be present
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders a distinct icon and text color per status", () => {
    const cases = [
      { status: "success", textClass: "text-[#266B49]" },
      { status: "danger", textClass: "text-[#B3261E]" },
      { status: "warning", textClass: "text-[#A4501F]" },
      { status: "neutral", textClass: "text-[#3C5667]" },
    ] as const;

    const icons = cases.map(({ status, textClass }) => {
      const { container, unmount } = render(<StatusPill status={status} label="Label" />);
      const pill = container.querySelector("[data-slot='status-pill']");
      expect(pill?.className).toContain(textClass);
      const icon = container.querySelector("svg")?.outerHTML;
      unmount();
      return icon;
    });

    // Each status (CheckCircle/XCircle/Clock/Circle) renders a visually
    // distinct default icon — all four outputs must be pairwise different.
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("renders custom icon when icon prop is provided", () => {
    const { container } = render(
      <StatusPill status="success" label="Featured" icon={<span data-testid="star" />} />,
    );
    expect(container.querySelector("[data-testid='star']")).toBeInTheDocument();
  });
});
