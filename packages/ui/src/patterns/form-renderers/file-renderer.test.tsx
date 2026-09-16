import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileRenderer } from "./file-renderer";
import { fileField } from "./test-fixtures";

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { value: [file] });
  fireEvent.change(input);
}

function makeFile(): File {
  return new File(["content"], "invoice.pdf", { type: "application/pdf" });
}

describe("FileRenderer", () => {
  it("renders the drop-zone prompt when no file is selected", () => {
    render(<FileRenderer {...fileField()} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText(/drag & drop a file, or click to select/i)).toBeInTheDocument();
  });

  it("shows the currently selected file", () => {
    const file = makeFile();
    render(<FileRenderer {...fileField()} value={file} onChange={vi.fn()} />);
    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
  });

  it("calls onChange with a bare File for a single-value field", () => {
    const onChange = vi.fn();
    render(<FileRenderer {...fileField()} value={undefined} onChange={onChange} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile();
    selectFile(input, file);
    expect(onChange).toHaveBeenCalledWith(file);
  });

  it("calls onChange with a one-element array for a multiValue field", () => {
    const onChange = vi.fn();
    render(
      <FileRenderer {...fileField({ multiple: true })} value={undefined} onChange={onChange} />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile();
    selectFile(input, file);
    expect(onChange).toHaveBeenCalledWith([file]);
  });

  it("calls onChange with undefined when the file is removed", () => {
    const onChange = vi.fn();
    const file = makeFile();
    render(<FileRenderer {...fileField()} value={file} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /remove file/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("reads a value already shaped as a one-element array (multiValue) back out as that file", () => {
    const file = makeFile();
    render(<FileRenderer {...fileField({ multiple: true })} value={[file]} onChange={vi.fn()} />);
    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
  });

  it("shows a static, non-editable message instead of a dropzone when read-only", () => {
    const file = makeFile();
    render(<FileRenderer {...fileField({ readOnly: true })} value={file} onChange={vi.fn()} />);
    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
    expect(screen.queryByText(/drag & drop/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });

  it("shows the error message when set", () => {
    render(
      <FileRenderer
        {...fileField()}
        value={undefined}
        onChange={vi.fn()}
        error="File is required"
      />,
    );
    expect(screen.getByText("File is required")).toBeInTheDocument();
  });
});
