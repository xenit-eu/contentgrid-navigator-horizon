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

describe("HalFormsFieldRenderer multi-valued dispatch", () => {
  it("renders a text-multi field as a free-text value list", () => {
    const field: HalFormsField = {
      name: "keywords",
      label: "Keywords",
      required: false,
      readOnly: false,
      kind: "text-multi",
      maxItems: 100,
      minItems: 0,
      property: DUMMY_PROPERTY,
    };
    render(<HalFormsFieldRenderer field={field} value={["a", "b"]} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Keywords" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove b" })).toBeInTheDocument();
  });

  it("renders a multi-valued enum field as a combobox", () => {
    const field: HalFormsField = {
      name: "letters",
      label: "Letters",
      required: false,
      readOnly: false,
      kind: "enum",
      multiValue: true,
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
      property: { options: { isRemote: () => false } } as unknown as HalFormsProperty,
    };
    render(<HalFormsFieldRenderer field={field} value={["a"]} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Letters" })).toHaveTextContent("A");
  });
});
