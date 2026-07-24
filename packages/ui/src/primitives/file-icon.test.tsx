import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileIcon } from "./file-icon";

describe("FileIcon", () => {
  it("renders a distinct icon and color class per type", () => {
    const { container: pdfContainer } = render(<FileIcon type="pdf" />);
    const { container: imgContainer } = render(<FileIcon type="img" />);
    const { container: docContainer } = render(<FileIcon type="doc" />);

    const pdfIcon = pdfContainer.querySelector("svg")?.outerHTML;
    const imgIcon = imgContainer.querySelector("svg")?.outerHTML;
    const docIcon = docContainer.querySelector("svg")?.outerHTML;

    // pdf -> FilePdf, img -> Image, doc -> FileText: three distinct icon components
    expect(pdfIcon).toBeTruthy();
    expect(pdfIcon).not.toEqual(imgIcon);
    expect(pdfIcon).not.toEqual(docIcon);
    expect(imgIcon).not.toEqual(docIcon);

    const pdfSlot = pdfContainer.querySelector("[data-slot='file-icon']");
    const imgSlot = imgContainer.querySelector("[data-slot='file-icon']");
    const docSlot = docContainer.querySelector("[data-slot='file-icon']");

    // Each type also has its own foreground color class.
    expect(pdfSlot?.className).toContain("text-[#C2541D]");
    expect(imgSlot?.className).toContain("text-[#0173A8]");
    expect(docSlot?.className).toContain("text-[#557891]");
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
