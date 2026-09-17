import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RelationAccordion } from "./relation-accordion";

function renderAccordion(overrides: Partial<Parameters<typeof RelationAccordion>[0]> = {}) {
  return render(
    <RelationAccordion title="Invoices" {...overrides}>
      {overrides.children ?? <p>Invoice list</p>}
    </RelationAccordion>,
  );
}

describe("RelationAccordion", () => {
  it("renders the title and children", () => {
    renderAccordion();
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByText("Invoice list")).toBeInTheDocument();
  });

  it("renders a composite title (e.g. title + badge) as given, with no opinion on its shape", () => {
    renderAccordion({
      title: (
        <>
          Invoices <span data-testid="badge">3</span>
        </>
      ),
    });
    expect(screen.getByText("Invoices")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toBeInTheDocument();
  });

  it("renders caller-supplied actions in the header", () => {
    renderAccordion({ actions: <button type="button">Link Invoices</button> });
    expect(screen.getByRole("button", { name: "Link Invoices" })).toBeInTheDocument();
  });

  it("renders no button besides the accordion trigger when actions is omitted", () => {
    renderAccordion();
    // The only button present should be the trigger itself, not an empty actions wrapper's content
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("clicking the trigger toggles the content without affecting actions", async () => {
    const user = userEvent.setup();
    renderAccordion({ actions: <button type="button">Link Invoices</button> });
    expect(screen.getByText("Invoice list")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^invoices/i }));
    expect(screen.queryByText("Invoice list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link Invoices" })).toBeInTheDocument();
  });
});
