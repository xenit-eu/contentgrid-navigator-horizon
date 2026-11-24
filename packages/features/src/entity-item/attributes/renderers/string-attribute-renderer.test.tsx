import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StringAttributeRenderer } from "./string-attribute-renderer";

describe("StringAttributeRenderer", () => {
  it("renders an em dash when value is null", () => {
    render(<StringAttributeRenderer value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders string values as-is", () => {
    render(<StringAttributeRenderer value="Acme Corp" />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("cuts a value longer than maxCharLength and shows the full value on hover", async () => {
    render(<StringAttributeRenderer value="Annual maintenance contract" maxCharLength={6} />);
    await userEvent.hover(screen.getByText("Annual…"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Annual maintenance contract");
  });

  it("shows no tooltip for a value within maxCharLength", async () => {
    render(<StringAttributeRenderer value="Annual" maxCharLength={6} />);
    await userEvent.hover(screen.getByText("Annual"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("stringifies numeric and boolean values", () => {
    const { rerender } = render(<StringAttributeRenderer value={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();

    rerender(<StringAttributeRenderer value={true} />);
    expect(screen.getByText("true")).toBeInTheDocument();
  });
});
