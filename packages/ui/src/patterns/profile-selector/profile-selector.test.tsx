import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileSelector } from "./profile-selector";
import type { Profile } from "./profile-selector";

const INVOICE: Profile = { name: "invoice", title: "Invoice" };
const CUSTOMER: Profile = { name: "customer", title: "Customer" };
const SUPPLIER: Profile = { name: "supplier", title: "Supplier" };

describe("ProfileSelector — visibility", () => {
  it("renders nothing when profiles list is empty", () => {
    const { container } = render(<ProfileSelector profiles={[]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when only one profile is available", () => {
    const { container } = render(<ProfileSelector profiles={[INVOICE]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the select trigger when exactly two profiles are available", () => {
    render(<ProfileSelector profiles={[INVOICE, CUSTOMER]} onSelect={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders the select trigger when three or more profiles are available", () => {
    render(<ProfileSelector profiles={[INVOICE, CUSTOMER, SUPPLIER]} onSelect={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});

describe("ProfileSelector — selected profile display", () => {
  it("shows the selected profile title in the trigger", () => {
    render(
      <ProfileSelector
        profiles={[INVOICE, CUSTOMER]}
        selectedProfile={INVOICE}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Invoice")).toBeInTheDocument();
  });

  it("shows placeholder text when no profile is selected", () => {
    render(<ProfileSelector profiles={[INVOICE, CUSTOMER]} onSelect={vi.fn()} />);
    expect(screen.getByText("Select profile")).toBeInTheDocument();
  });
});

describe("ProfileSelector — label prop", () => {
  it("renders the label text when label is provided", () => {
    render(<ProfileSelector profiles={[INVOICE, CUSTOMER]} onSelect={vi.fn()} label="Entity" />);
    expect(screen.getByText("Entity")).toBeInTheDocument();
  });

  it("does not render label text when label is omitted", () => {
    render(<ProfileSelector profiles={[INVOICE, CUSTOMER]} onSelect={vi.fn()} />);
    expect(screen.queryByText("Entity")).toBeNull();
  });
});

describe("ProfileSelector — profile switch", () => {
  it("calls onSelect with the chosen profile when the user picks one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ProfileSelector
        profiles={[INVOICE, CUSTOMER, SUPPLIER]}
        selectedProfile={INVOICE}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Customer" }));

    expect(onSelect).toHaveBeenCalledWith(CUSTOMER);
  });

  it("does not call onSelect when the already-selected profile is chosen again", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ProfileSelector
        profiles={[INVOICE, CUSTOMER]}
        selectedProfile={INVOICE}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    // Radix Select suppresses onChange when the same value is selected
    await user.click(screen.getByRole("option", { name: "Invoice" }));

    expect(onSelect).toHaveBeenCalledTimes(0);
  });

  it("lists all profile titles as options", async () => {
    const user = userEvent.setup();
    render(
      <ProfileSelector
        profiles={[INVOICE, CUSTOMER, SUPPLIER]}
        selectedProfile={INVOICE}
        onSelect={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("option", { name: "Invoice" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Customer" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Supplier" })).toBeInTheDocument();
  });
});
