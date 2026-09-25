import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { HalFormsProperty } from "@contentgrid/navigator-data";
import type { HalFormsField } from "../model/hal-forms-field";
import { HalFormsFieldRenderer } from "./hal-forms-field-renderer";

const DUMMY_PROPERTY = {} as unknown as HalFormsProperty;

const emailField: HalFormsField = {
  name: "email",
  label: "Email",
  required: false,
  readOnly: false,
  kind: "text",
  property: DUMMY_PROPERTY,
};

const cityField: HalFormsField = {
  name: "city",
  label: "City",
  required: false,
  readOnly: false,
  kind: "autocomplete",
  multiValue: false,
  property: DUMMY_PROPERTY,
};

describe("HalFormsFieldRenderer provenance", () => {
  it("renders no provenance indicator when the field state has no provenance", () => {
    render(
      <HalFormsFieldRenderer
        field={emailField}
        value=""
        onChange={vi.fn()}
        fieldState={{ errors: [] }}
      />,
    );
    expect(screen.queryByRole("button", { name: /provenance/i })).not.toBeInTheDocument();
  });

  it("renders no provenance indicator at all when fieldState itself is absent", () => {
    render(<HalFormsFieldRenderer field={emailField} value="" onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /provenance/i })).not.toBeInTheDocument();
  });

  it("opens a popover showing the field's provenance content when the indicator is clicked", async () => {
    const user = userEvent.setup();
    render(
      <HalFormsFieldRenderer
        field={emailField}
        value="a@b.com"
        onChange={vi.fn()}
        fieldState={{ errors: [], provenance: "Filled by automation X on 2026-09-18" }}
      />,
    );

    const indicator = screen.getByRole("button", { name: /provenance/i });
    await user.click(indicator);

    expect(await screen.findByText("Filled by automation X on 2026-09-18")).toBeInTheDocument();
  });
});

describe("HalFormsFieldRenderer autocomplete dispatch", () => {
  it("renders an inert placeholder when no autocomplete state has been wired up", () => {
    render(<HalFormsFieldRenderer field={cityField} value="" onChange={vi.fn()} />);
    expect(screen.getByText(/not yet supported/i)).toBeInTheDocument();
  });

  it("renders AutocompleteRenderer with the wired-up suggestions once fieldState.autocomplete is present", () => {
    render(
      <HalFormsFieldRenderer
        field={cityField}
        value=""
        onChange={vi.fn()}
        fieldState={{
          errors: [],
          autocomplete: { suggestions: ["Paris"], onQueryChange: vi.fn() },
        }}
      />,
    );
    expect(screen.getByRole("combobox", { name: "City" })).toBeInTheDocument();
  });
});
