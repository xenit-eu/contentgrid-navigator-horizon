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

  it("renders a titled nested section as a group named by its title, with the description attached", () => {
    render(
      <HalFormsContainer
        fields={[
          { ...nameField, name: "amount", label: "Amount" },
          { ...emailField, name: "amount~gte", label: "From" },
          { ...phoneField, name: "amount~lte", label: "Until" },
        ]}
        layout={{
          sections: [
            {
              rows: [
                {
                  title: "Amount",
                  description: "Invoice total",
                  rows: [{ fieldNames: ["amount"] }, { fieldNames: ["amount~gte", "amount~lte"] }],
                },
              ],
            },
          ],
        }}
        values={{}}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );
    const group = screen.getByRole("group", { name: "Amount" });
    expect(group).toHaveAccessibleDescription("Invoice total");
    expect(within(group).getByLabelText(/Amount/)).toBeInTheDocument();
    expect(within(group).getByLabelText(/From/)).toBeInTheDocument();
    expect(within(group).getByLabelText(/Until/)).toBeInTheDocument();
  });

  it("renders a nested section inside a collapsible section's content, in row order", async () => {
    const user = userEvent.setup();
    render(
      <HalFormsContainer
        fields={[nameField, { ...emailField, name: "age~gte", label: "From" }]}
        layout={{
          sections: [
            {
              title: "Friends",
              isCollapsible: true,
              rows: [
                { fieldNames: ["name"] },
                { title: "Age", rows: [{ fieldNames: ["age~gte"] }] },
              ],
            },
          ],
        }}
        values={{}}
        onChange={vi.fn()}
        fieldState={{}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Friends" }));
    const group = screen.getByRole("group", { name: "Age" });
    expect(within(group).getByLabelText(/From/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/).compareDocumentPosition(group)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("renders plain rows without a group wrapper", () => {
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
