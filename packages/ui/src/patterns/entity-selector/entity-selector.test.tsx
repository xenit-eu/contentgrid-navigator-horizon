import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileEntitySelector, ProfileEntitySelectorList } from "./entity-selector";

const INVOICE = { name: "invoice", title: "Invoice" };
const CUSTOMER = { name: "customer", title: "Customer" };

describe("ProfileEntitySelector — selected entity display", () => {
  it("shows the selected entity title in the trigger", () => {
    render(
      <ProfileEntitySelector
        entities={[INVOICE, CUSTOMER]}
        selectedEntity={INVOICE}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Invoice")).toBeInTheDocument();
  });

  it("shows placeholder text when no entity is selected", () => {
    render(<ProfileEntitySelector entities={[INVOICE, CUSTOMER]} onSelect={vi.fn()} />);
    expect(screen.getByText("Select entity")).toBeInTheDocument();
  });
});

describe("ProfileEntitySelector — label prop", () => {
  it("renders the label text when label is provided", () => {
    render(
      <ProfileEntitySelector entities={[INVOICE, CUSTOMER]} onSelect={vi.fn()} label="Entity" />,
    );
    expect(screen.getByText("Entity")).toBeInTheDocument();
  });

  it("names the trigger after the label", () => {
    render(
      <ProfileEntitySelector entities={[INVOICE, CUSTOMER]} onSelect={vi.fn()} label="Entity" />,
    );
    expect(screen.getByRole("combobox", { name: "Entity" })).toBeInTheDocument();
  });

  it("does not render label text when label is omitted", () => {
    render(<ProfileEntitySelector entities={[INVOICE, CUSTOMER]} onSelect={vi.fn()} />);
    expect(screen.queryByText("Entity")).toBeNull();
  });
});

describe("ProfileEntitySelector — option content", () => {
  it("shows each entity's description in its option row", async () => {
    const user = userEvent.setup();
    render(
      <ProfileEntitySelector
        entities={[{ ...INVOICE, description: "A supplier invoice" }, CUSTOMER]}
        onSelect={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByText("A supplier invoice")).toBeInTheDocument();
  });
});

describe("ProfileEntitySelectorList", () => {
  it("marks only the selected entity as checked", () => {
    render(
      <ProfileEntitySelectorList
        entities={[INVOICE, CUSTOMER]}
        selectedEntity={CUSTOMER}
        onSelect={vi.fn()}
        label="Entity"
      />,
    );

    expect(screen.getByRole("radio", { name: "Customer" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Invoice" })).toHaveAttribute("aria-checked", "false");
  });

  it("shows each entity's description in its row", () => {
    render(
      <ProfileEntitySelectorList
        entities={[{ ...INVOICE, description: "A supplier invoice" }, CUSTOMER]}
        onSelect={vi.fn()}
        label="Entity"
      />,
    );

    expect(screen.getByRole("radio", { name: /A supplier invoice/ })).toBeInTheDocument();
  });
});
