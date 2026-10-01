import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test-setup";
import { ClassifyCreateEntityItemView } from "./classify-create-entity-item-view";
import { type EntityFixture, profileHandlers, renderWithNavigatorData } from "./test-utils";

const INVOICE: EntityFixture = {
  name: "invoice",
  plural: "invoices",
  title: "Invoice",
  description: "A supplier invoice with line items and content.",
  creatable: true,
};
const SUPPLIER: EntityFixture = {
  name: "supplier",
  plural: "suppliers",
  title: "Supplier",
  creatable: true,
};
const AUDIT_LOG: EntityFixture = {
  name: "audit-log",
  plural: "audit-logs",
  title: "Audit Log",
  creatable: false,
};

describe("ClassifyCreateEntityItemView", () => {
  it("offers only the entities that have a create form", async () => {
    const user = userEvent.setup();
    server.use(...profileHandlers([INVOICE, SUPPLIER, AUDIT_LOG]));
    renderWithNavigatorData(<ClassifyCreateEntityItemView onSelect={vi.fn()} onCancel={vi.fn()} />);

    await user.click(await screen.findByRole("combobox", { name: "Entity" }));

    expect(screen.getByRole("option", { name: /Invoice/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Supplier/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Audit Log/ })).not.toBeInTheDocument();
  });

  it("says there is nothing to create when no entity has a create form", async () => {
    server.use(...profileHandlers([AUDIT_LOG]));
    renderWithNavigatorData(<ClassifyCreateEntityItemView onSelect={vi.fn()} onCancel={vi.fn()} />);

    expect(await screen.findByText("There is nothing you can create.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
