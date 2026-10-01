import { render, screen, within } from "@testing-library/react";
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

  it("renders a row's description once below its fields, describing the whole row", () => {
    render(
      <HalFormsContainer
        fields={[
          { ...emailField, name: "amount~gte", label: "Amount from" },
          { ...phoneField, name: "amount~lte", label: "Amount until" },
        ]}
        layout={{
          sections: [
            {
              rows: [{ fieldNames: ["amount~gte", "amount~lte"], description: "Invoice total" }],
            },
          ],
        }}
        values={{}}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );
    const group = screen.getByRole("group");
    expect(group).toHaveAccessibleDescription("Invoice total");
    expect(screen.getAllByText("Invoice total")).toHaveLength(1);
    expect(within(group).getByLabelText(/Amount from/)).toBeInTheDocument();
    expect(within(group).getByLabelText(/Amount until/)).toBeInTheDocument();
  });

  it("renders a row without a description without a group wrapper", () => {
    render(
      <HalFormsContainer
        fields={[nameField]}
        layout={{ sections: [{ rows: [{ fieldNames: ["name"] }] }] }}
        values={{ name: "" }}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
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

  it("keeps a collapsible section's description out of the toggle button and describes its content with it", () => {
    render(
      <HalFormsContainer
        fields={[nameField]}
        layout={{
          sections: [
            {
              title: "Customer",
              description: "The company that placed this order",
              isCollapsible: true,
              rows: [{ fieldNames: ["name"] }],
            },
          ],
        }}
        values={{ name: "" }}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Customer" });
    expect(trigger).not.toHaveTextContent("The company that placed this order");
    expect(screen.getByRole("region", { name: "Customer" })).toHaveAccessibleDescription(
      "The company that placed this order",
    );
  });

  it("starts a collapsible section expanded and collapses all its rows together on toggle", async () => {
    const user = userEvent.setup();
    render(
      <HalFormsContainer
        fields={[nameField, emailField]}
        layout={{
          sections: [
            {
              title: "Contact",
              isCollapsible: true,
              rows: [{ fieldNames: ["name"] }, { fieldNames: ["email"] }],
            },
          ],
        }}
        values={{ name: "", email: "" }}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );

    expect(screen.getByLabelText(/Name/)).toBeVisible();
    expect(screen.getByLabelText(/Email/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Contact" }));

    expect(screen.queryByLabelText(/Name/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Email/)).not.toBeInTheDocument();
  });
});
