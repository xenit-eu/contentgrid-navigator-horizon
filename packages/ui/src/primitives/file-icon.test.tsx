import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileIcon } from "./file-icon";

describe("FileIcon", () => {
  it("renders SVG for pdf type", () => {
    const { container } = render(<FileIcon type="pdf" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders SVG for img type", () => {
    const { container } = render(<FileIcon type="img" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders SVG for doc type", () => {
    const { container } = render(<FileIcon type="doc" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("uses doc as default type when type is omitted", () => {
    const { container } = render(<FileIcon />);
    expect(container.querySelector("[data-slot='file-icon']")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("applies the given size as inline style", () => {
    const { container } = render(<FileIcon size={48} />);
    const el = container.querySelector("[data-slot='file-icon']") as HTMLElement;
    expect(el.style.width).toBe("48px");
    expect(el.style.height).toBe("48px");
  });

  it("renders data-slot attribute", () => {
    const { container } = render(<FileIcon />);
    expect(container.querySelector("[data-slot='file-icon']")).toBeInTheDocument();
  });
});
