import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnknownAttributeRenderer } from "./unknown-attribute-renderer";

describe("UnknownAttributeRenderer", () => {
  it("renders an empty attribute value", () => {
    render(<UnknownAttributeRenderer />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
