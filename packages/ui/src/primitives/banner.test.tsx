import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Banner } from "./banner";

describe("Banner", () => {
  it("renders message text", () => {
    render(<Banner text="This is a notice" />);
    expect(screen.getByText("This is a notice")).toBeInTheDocument();
  });

  it("uses info tone as default when tone is omitted — has status role", () => {
    render(<Banner text="Default" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders with edit tone — has status role", () => {
    render(<Banner text="Edit mode" tone="edit" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders with warning tone — has alert role", () => {
    render(<Banner text="Warning!" tone="warning" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders a tone-specific default icon and color class per tone", () => {
    const { container: infoContainer } = render(<Banner text="Info" tone="info" />);
    const { container: editContainer } = render(<Banner text="Edit" tone="edit" />);
    const { container: warningContainer } = render(<Banner text="Warn" tone="warning" />);

    const infoIcon = infoContainer.querySelector("svg")?.outerHTML;
    const editIcon = editContainer.querySelector("svg")?.outerHTML;
    const warningIcon = warningContainer.querySelector("svg")?.outerHTML;

    // info (Info icon) and edit (PencilSimpleLine icon) share the same role/color
    // classes but must render visibly distinct default icons.
    expect(infoIcon).toBeTruthy();
    expect(infoIcon).not.toEqual(editIcon);
    // warning (Warning icon) is distinct from both.
    expect(warningIcon).not.toEqual(infoIcon);
    expect(warningIcon).not.toEqual(editIcon);

    const infoBanner = infoContainer.querySelector("[data-slot='banner']");
    const warningBanner = warningContainer.querySelector("[data-slot='banner']");
    // info/edit share the blue text color; warning uses the distinct amber color.
    expect(infoBanner?.className).toContain("text-[#084772]");
    expect(warningBanner?.className).toContain("text-[#A4501F]");
    expect(warningBanner?.className).not.toContain("text-[#084772]");
  });

  it("renders custom icon when icon prop is provided", () => {
    render(<Banner text="Custom" icon={<span data-testid="custom-icon" />} />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("has data-slot=banner attribute", () => {
    const { container } = render(<Banner text="Test" />);
    expect(container.querySelector("[data-slot='banner']")).toBeInTheDocument();
  });
});
