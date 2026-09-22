import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { HalFormsProperty } from "@contentgrid/navigator-data";
import type { HalFormsField } from "../model/hal-forms-field";
import { HalFormsContainer } from "./hal-forms-container";

const DUMMY_PROPERTY = {} as unknown as HalFormsProperty;

const nameField: HalFormsField = {
  name: "name",
  label: "Name",
  required: true,
  readOnly: false,
  kind: "text",
  property: DUMMY_PROPERTY,
};

const emailField: HalFormsField = {
  name: "email",
  label: "Email",
  required: false,
  readOnly: false,
  kind: "text",
  property: DUMMY_PROPERTY,
};

const phoneField: HalFormsField = {
  name: "phone",
  label: "Phone",
  required: false,
  readOnly: false,
  kind: "text",
  property: DUMMY_PROPERTY,
};

describe("HalFormsContainer", () => {
  it("renders a two-field row side by side in a 2-col grid, in schema order", () => {
    const { container } = render(
      <HalFormsContainer
        fields={[nameField, emailField]}
        layout={{ sections: [{ rows: [{ fieldNames: ["email", "name"] }] }] }}
        values={{ email: "a@b.com", name: "Acme" }}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );
    const row = container.querySelector(".grid-cols-2");
    expect(row).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toHaveValue("a@b.com");
    expect(screen.getByLabelText(/Name/)).toHaveValue("Acme");
  });

  it("renders a single-field row without the 2-col grid wrapper", () => {
    const { container } = render(
      <HalFormsContainer
        fields={[phoneField]}
        layout={{ sections: [{ rows: [{ fieldNames: ["phone"] }] }] }}
        values={{ phone: "555" }}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );
    expect(container.querySelector(".grid-cols-2")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Phone/)).toHaveValue("555");
  });

  it("skips a row's reference to a field absent from the resolved fields, without throwing", () => {
    render(
      <HalFormsContainer
        fields={[nameField]}
        layout={{ sections: [{ rows: [{ fieldNames: ["name", "ghost"] }] }] }}
        values={{ name: "" }}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
  });

  it("renders no header at all for a section with no title and no description", () => {
    const { container } = render(
      <HalFormsContainer
        fields={[nameField]}
        layout={{ sections: [{ rows: [{ fieldNames: ["name"] }] }] }}
        values={{ name: "" }}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });

  it("renders a section's title and description above its rows", () => {
    render(
      <HalFormsContainer
        fields={[nameField]}
        layout={{
          sections: [
            {
              title: "Contact",
              description: "How to reach this person",
              rows: [{ fieldNames: ["name"] }],
            },
          ],
        }}
        values={{ name: "" }}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );
    expect(screen.getByText("Contact")).toBeInTheDocument();
    expect(screen.getByText("How to reach this person")).toBeInTheDocument();
  });

  it("keeps a non-collapsible titled section's rows always visible", () => {
    render(
      <HalFormsContainer
        fields={[nameField]}
        layout={{ sections: [{ title: "Contact", rows: [{ fieldNames: ["name"] }] }] }}
        values={{ name: "" }}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );
    expect(screen.getByLabelText(/Name/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Contact" })).not.toBeInTheDocument();
  });

  it("collapses a collapsible section's rows by default and expands them on toggle", async () => {
    const user = userEvent.setup();
    render(
      <HalFormsContainer
        fields={[nameField]}
        layout={{
          sections: [{ title: "Contact", isCollapsible: true, rows: [{ fieldNames: ["name"] }] }],
        }}
        values={{ name: "" }}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );

    expect(screen.queryByLabelText(/Name/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Contact" }));

    expect(screen.getByLabelText(/Name/)).toBeVisible();
  });
});
