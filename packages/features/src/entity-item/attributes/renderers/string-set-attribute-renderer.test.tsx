import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StringSetAttributeRenderer } from "./string-set-attribute-renderer";

describe("StringSetAttributeRenderer", () => {
  it("joins the strings with a comma", () => {
    render(<StringSetAttributeRenderer value={["urgent", "paid"]} />);
    expect(screen.getByText("urgent, paid")).toBeInTheDocument();
  });

  it("truncates the joined text to maxCharLength", () => {
    render(<StringSetAttributeRenderer value={["urgent", "paid"]} maxCharLength={6} />);
    expect(screen.getByText("urgent…")).toBeInTheDocument();
  });

  it("renders an em dash for null or an empty list", () => {
    const { rerender } = render(<StringSetAttributeRenderer value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    rerender(<StringSetAttributeRenderer value={[]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  describe("table variant", () => {
    it("renders comma-separated text, not chips", () => {
      const { container } = render(
        <StringSetAttributeRenderer value={["a", "b", "c", "d", "e", "f"]} variant="table" />,
      );
      expect(screen.getByText("a, b, c, d, e, f")).toBeInTheDocument();
      expect(container.querySelector('[data-slot="chip"]')).toBeNull();
    });

    it("applies maxCharLength to the joined text", () => {
      render(
        <StringSetAttributeRenderer value={["urgent", "paid"]} variant="table" maxCharLength={9} />,
      );
      expect(screen.getByText("urgent, p…")).toBeInTheDocument();
    });
  });

  describe("attribute-table variant", () => {
    const values = ["a", "b", "c", "d", "e", "f", "g"];

    it("shows every value as a chip, with no +N chip", () => {
      const { container } = render(
        <StringSetAttributeRenderer value={values} variant="attribute-table" />,
      );
      expect(container.querySelectorAll('[data-slot="chip"]')).toHaveLength(values.length);
      expect(screen.getByText("g")).toBeInTheDocument();
      expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
    });

    it("puts hidden commas between the chips so a copy yields a list", () => {
      const { container } = render(
        <StringSetAttributeRenderer value={values} variant="attribute-table" />,
      );
      const commas = container.querySelectorAll(".sr-only");
      expect(commas).toHaveLength(values.length - 1);
      commas.forEach((comma) => expect(comma.textContent).toBe(", "));
      expect(container).toHaveTextContent("a, b, c, d, e, f, g");
    });

    it("applies maxCharLength to each chip's text and keeps the full text as its description", () => {
      render(
        <StringSetAttributeRenderer
          value={["urgent", "ok"]}
          variant="attribute-table"
          maxCharLength={3}
        />,
      );
      expect(screen.getByText("urg…")).toBeInTheDocument();
      expect(screen.getByText("urgent")).toHaveClass("sr-only");
      expect(screen.getByText("ok")).toBeInTheDocument();
    });

    it("lets the chips wrap onto new rows despite the table cell's nowrap", () => {
      const { container } = render(
        <StringSetAttributeRenderer value={["a", "b"]} variant="attribute-table" />,
      );
      expect(container.querySelector('[data-slot="string-set-chips"]')).toHaveClass(
        "whitespace-normal",
      );
    });

    it("keeps the chips on one line when wrap is off", () => {
      const { container } = render(
        <StringSetAttributeRenderer value={["a", "b"]} variant="attribute-table" wrap={false} />,
      );
      expect(container.querySelector('[data-slot="string-set-chips"]')).toHaveClass(
        "whitespace-nowrap",
      );
    });

    it("renders an em dash for an empty list", () => {
      const { container } = render(
        <StringSetAttributeRenderer value={[]} variant="attribute-table" />,
      );
      expect(screen.getByText("—")).toBeInTheDocument();
      expect(container.querySelector('[data-slot="chip"]')).toBeNull();
    });
  });
});
