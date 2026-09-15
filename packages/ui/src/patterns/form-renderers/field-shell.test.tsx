import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldShell } from "./field-shell";

describe("FieldShell", () => {
  it("shows a required marker when required", () => {
    render(
      <FieldShell name="due_date" label="Due date" required>
        <input id="due_date" />
      </FieldShell>,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows the description when there is no error", () => {
    render(
      <FieldShell name="due_date" label="Due date" required={false} description="When this is due">
        <input id="due_date" />
      </FieldShell>,
    );
    expect(screen.getByText("When this is due")).toBeInTheDocument();
  });

  it("shows the error instead of the description", () => {
    render(
      <FieldShell
        name="due_date"
        label="Due date"
        required={false}
        description="When this is due"
        error="Due date is required"
      >
        <input id="due_date" />
      </FieldShell>,
    );
    expect(screen.getByText("Due date is required")).toBeInTheDocument();
    expect(screen.queryByText("When this is due")).not.toBeInTheDocument();
  });
});
