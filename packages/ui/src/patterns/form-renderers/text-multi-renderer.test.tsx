import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { textMultiField } from "./test-fixtures";
import { TextMultiRenderer } from "./text-multi-renderer";

describe("TextMultiRenderer", () => {
  it("shows every value as a chip", () => {
    render(<TextMultiRenderer {...textMultiField()} value={["a", "b"]} onChange={vi.fn()} />);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
  });

  it("adds the typed value on Enter, trimmed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextMultiRenderer {...textMultiField()} value={["a"]} onChange={onChange} />);
    await user.type(screen.getByLabelText("Keywords"), "  b  {Enter}");
    expect(onChange).toHaveBeenCalledWith(["a", "b"]);
    expect(screen.getByLabelText("Keywords")).toHaveValue("");
  });

  it("does not submit the surrounding form on Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TextMultiRenderer {...textMultiField()} value={[]} onChange={vi.fn()} />
      </form>,
    );
    await user.type(screen.getByLabelText("Keywords"), "a{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("ignores empty and duplicate values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextMultiRenderer {...textMultiField()} value={["a"]} onChange={onChange} />);
    const input = screen.getByLabelText("Keywords");
    await user.type(input, "   {Enter}");
    await user.type(input, "a{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a value with its chip's remove button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextMultiRenderer {...textMultiField()} value={["a", "b"]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Remove a" }));
    expect(onChange).toHaveBeenCalledWith(["b"]);
  });

  it("removes the last value on Backspace in the empty input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextMultiRenderer {...textMultiField()} value={["a", "b"]} onChange={onChange} />);
    await user.type(screen.getByLabelText("Keywords"), "{Backspace}");
    expect(onChange).toHaveBeenCalledWith(["a"]);
  });

  it("adds one value per line when several lines are pasted", () => {
    const onChange = vi.fn();
    render(<TextMultiRenderer {...textMultiField()} value={["a"]} onChange={onChange} />);
    fireEvent.paste(screen.getByLabelText("Keywords"), {
      clipboardData: { getData: () => "b\nc\r\n\na" },
    });
    expect(onChange).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("adds what is still typed when the field loses focus", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <TextMultiRenderer {...textMultiField()} value={[]} onChange={onChange} onBlur={onBlur} />,
    );
    await user.type(screen.getByLabelText("Keywords"), "a");
    await user.tab();
    expect(onChange).toHaveBeenCalledWith(["a"]);
    expect(onBlur).toHaveBeenCalled();
  });

  it("stops accepting values at maxItems", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <TextMultiRenderer {...textMultiField({ maxItems: 2 })} value={["a"]} onChange={onChange} />,
    );
    fireEvent.paste(screen.getByLabelText("Keywords"), {
      clipboardData: { getData: () => "b\nc" },
    });
    expect(onChange).toHaveBeenCalledWith(["a", "b"]);

    rerender(
      <TextMultiRenderer
        {...textMultiField({ maxItems: 2 })}
        value={["a", "b"]}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText("Keywords")).toBeDisabled();
    expect(screen.getByLabelText("Keywords")).toHaveAttribute("placeholder", "Maximum of 2 values");
    await user.click(screen.getByRole("button", { name: "Remove a" }));
    expect(onChange).toHaveBeenLastCalledWith(["b"]);
  });

  it("shows the values without remove buttons or an input when read-only", () => {
    render(
      <TextMultiRenderer
        {...textMultiField({ readOnly: true })}
        value={["a"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("marks the input invalid and describes it with the hint and the error", () => {
    render(
      <TextMultiRenderer
        {...textMultiField({ error: "Keywords is required" })}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Keywords");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "keywords-hint keywords-error");
  });
});
