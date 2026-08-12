import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { ValidationAlert } from "./validation-alert";

function validationModel(
  fields: Extract<ProblemDisplayModel, { kind: "validation" }>["fields"],
): Extract<ProblemDisplayModel, { kind: "validation" }> {
  return { kind: "validation", status: 400, title: "Validation error", fields };
}

describe("ValidationAlert", () => {
  it("renders the wrapper title/status and every field message", () => {
    render(
      <ValidationAlert
        model={validationModel([
          { kind: "required", field: "name", message: "Mandatory field" },
          {
            kind: "duplicate",
            field: "product_code",
            message: "Duplicate",
            conflictingItem: "https://app/products/1",
          },
        ])}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("400")).toBeInTheDocument();
    expect(screen.getByText(/Mandatory field/)).toBeInTheDocument();
    expect(screen.getByText(/Duplicate/)).toBeInTheDocument();
  });

  it("fires onConflictingItemClick with the conflicting item URL and field", async () => {
    const user = userEvent.setup();
    const onConflictingItemClick = vi.fn();
    render(
      <ValidationAlert
        model={validationModel([
          {
            kind: "duplicate",
            field: "product_code",
            message: "Duplicate",
            conflictingItem: "https://app/products/1",
          },
        ])}
        onConflictingItemClick={onConflictingItemClick}
      />,
    );
    await user.click(screen.getByRole("button", { name: "View conflicting item" }));
    expect(onConflictingItemClick).toHaveBeenCalledWith("https://app/products/1", "product_code");
  });

  it("does not render the conflicting-item button when the callback is omitted", () => {
    render(
      <ValidationAlert
        model={validationModel([
          {
            kind: "duplicate",
            field: "product_code",
            message: "Duplicate",
            conflictingItem: "https://app/products/1",
          },
        ])}
      />,
    );
    expect(screen.queryByRole("button", { name: "View conflicting item" })).not.toBeInTheDocument();
  });

  it("fires onMissingRelationTargetClick with the missing item URL", async () => {
    const user = userEvent.setup();
    const onMissingRelationTargetClick = vi.fn();
    render(
      <ValidationAlert
        model={validationModel([
          {
            kind: "missingRelationTarget",
            field: "person",
            message: "Missing target",
            missingItem: "https://app/persons/1",
          },
        ])}
        onMissingRelationTargetClick={onMissingRelationTargetClick}
      />,
    );
    await user.click(screen.getByRole("button", { name: "View missing item" }));
    expect(onMissingRelationTargetClick).toHaveBeenCalledWith("https://app/persons/1", "person");
  });

  it("fires onAllowedValuesClick with the allowed values array", async () => {
    const user = userEvent.setup();
    const onAllowedValuesClick = vi.fn();
    render(
      <ValidationAlert
        model={validationModel([
          {
            kind: "allowedValues",
            field: "category",
            message: "Not allowed",
            allowedValues: ["a", "b"],
          },
        ])}
        onAllowedValuesClick={onAllowedValuesClick}
      />,
    );
    await user.click(screen.getByRole("button", { name: "View allowed values" }));
    expect(onAllowedValuesClick).toHaveBeenCalledWith(["a", "b"], "category");
  });

  it("fires onExpectedTypeClick for a type field error", async () => {
    const user = userEvent.setup();
    const onExpectedTypeClick = vi.fn();
    render(
      <ValidationAlert
        model={validationModel([
          {
            kind: "type",
            field: "total",
            message: "Wrong type",
            expectedType: "long",
            actualType: "list",
          },
        ])}
        onExpectedTypeClick={onExpectedTypeClick}
      />,
    );
    await user.click(screen.getByRole("button", { name: "View expected type" }));
    expect(onExpectedTypeClick).toHaveBeenCalledWith({
      field: "total",
      expectedType: "long",
      actualType: "list",
    });
  });

  it("fires onExpectedTypeClick for a typeFormat field error", async () => {
    const user = userEvent.setup();
    const onExpectedTypeClick = vi.fn();
    render(
      <ValidationAlert
        model={validationModel([
          {
            kind: "typeFormat",
            field: "invoice_date",
            message: "Bad format",
            expectedType: "datetime",
            formatError: "not RFC3339",
          },
        ])}
        onExpectedTypeClick={onExpectedTypeClick}
      />,
    );
    await user.click(screen.getByRole("button", { name: "View expected type" }));
    expect(onExpectedTypeClick).toHaveBeenCalledWith({
      field: "invoice_date",
      expectedType: "datetime",
      formatError: "not RFC3339",
    });
  });

  it("renders no action button for required/noContent/pattern/unknownField kinds", () => {
    render(
      <ValidationAlert
        model={validationModel([
          { kind: "required", field: "name", message: "Mandatory field" },
          { kind: "noContent", field: "content", message: "No content" },
          { kind: "pattern", field: "mimetype", message: "Bad pattern", pattern: "^image/.*$" },
          { kind: "unknownField", field: "future", message: "Future kind" },
        ])}
      />,
    );
    expect(screen.queryByRole("button", { name: /^(?!Dismiss$)/ })).not.toBeInTheDocument();
  });
});
