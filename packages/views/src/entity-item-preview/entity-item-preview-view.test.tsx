import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createContentFixtureFetch } from "../test-fixtures/content-item";
import { CUSTOMER_ITEM_URL, createFixtureFetch } from "../test-fixtures/item-detail";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityItemPreviewView } from "./entity-item-preview-view";

beforeEach(() => {
  // jsdom doesn't implement Blob URLs (the image preview needs one).
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  // @ts-expect-error -- removing the jsdom-absent methods stubbed above.
  delete URL.createObjectURL;
  // @ts-expect-error -- see above.
  delete URL.revokeObjectURL;
});

const setup = () => createItemDetailTestHarness({ fetchFn: createContentFixtureFetch().fetch });

describe("EntityItemPreviewView", () => {
  it("shows the file of an item that has content", async () => {
    const { Wrapper } = setup();
    render(<EntityItemPreviewView entityName="document" itemId="doc-001" />, { wrapper: Wrapper });

    expect(await screen.findByRole("img", { name: "report.png" })).toBeInTheDocument();
    // Not the attribute table.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the attributes of an item whose content attributes hold no file", async () => {
    const { Wrapper } = setup();
    render(<EntityItemPreviewView entityName="document" itemId="doc-002" />, { wrapper: Wrapper });

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getAllByText("Empty draft").length).toBeGreaterThan(0);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the attributes of an entity without content", async () => {
    const { Wrapper } = createItemDetailTestHarness();
    render(<EntityItemPreviewView entityName="customer" itemId="cust-001" />, { wrapper: Wrapper });

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Corp").length).toBeGreaterThan(0);
  });

  it("offers Open and Close only, with no edit, delete or upload controls", async () => {
    const { Wrapper } = createItemDetailTestHarness();
    render(<EntityItemPreviewView entityName="customer" itemId="cust-001" onClose={vi.fn()} />, {
      wrapper: Wrapper,
    });
    await screen.findByRole("table");

    expect(screen.getByRole("link", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close preview" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit|delete|save/i })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });

  it("shows no drop zone for an empty content attribute", async () => {
    const { Wrapper } = setup();
    render(<EntityItemPreviewView entityName="document" itemId="doc-002" />, { wrapper: Wrapper });
    await screen.findByRole("table");

    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });

  it("opens the full detail view through the navigation object", async () => {
    const { Wrapper, recording } = createItemDetailTestHarness();
    render(<EntityItemPreviewView entityName="customer" itemId="cust-001" />, { wrapper: Wrapper });
    await screen.findByRole("table");

    const open = screen.getByRole("link", { name: "Open" });
    expect(open).toHaveAttribute("href", "/customer/cust-001");
    await userEvent.click(open);

    expect(recording.calls).toEqual([{ method: "openItem", args: ["customer", "cust-001"] }]);
  });

  it("leaves a modified click on Open to the browser", async () => {
    const { Wrapper, recording } = createItemDetailTestHarness();
    render(<EntityItemPreviewView entityName="customer" itemId="cust-001" />, { wrapper: Wrapper });
    await screen.findByRole("table");

    fireEvent.click(screen.getByRole("link", { name: "Open" }), { ctrlKey: true });

    expect(recording.calls).toEqual([]);
  });

  it("reports Close to the host, and draws no Close button without onClose", async () => {
    const onClose = vi.fn();
    const { Wrapper } = createItemDetailTestHarness();
    const { rerender } = render(
      <EntityItemPreviewView entityName="customer" itemId="cust-001" onClose={onClose} />,
      { wrapper: Wrapper },
    );
    await screen.findByRole("table");

    await userEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<EntityItemPreviewView entityName="customer" itemId="cust-001" />);
    expect(screen.queryByRole("button", { name: "Close preview" })).not.toBeInTheDocument();
  });

  it("adds the host's actions, and draws no toolbar when hidden", async () => {
    const { Wrapper } = createItemDetailTestHarness();
    const { rerender } = render(
      <EntityItemPreviewView
        entityName="customer"
        itemId="cust-001"
        toolbar={{ actions: <button>Host action</button> }}
      />,
      { wrapper: Wrapper },
    );
    expect(await screen.findByRole("button", { name: "Host action" })).toBeInTheDocument();

    rerender(<EntityItemPreviewView entityName="customer" itemId="cust-001" toolbar={false} />);
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("shows a loading state first", async () => {
    const { Wrapper } = createItemDetailTestHarness();
    render(<EntityItemPreviewView entityName="customer" itemId="cust-001" />, { wrapper: Wrapper });

    expect(screen.getByRole("status")).toBeInTheDocument();
    await screen.findByRole("table");
  });

  it("shows the problem for an item that fails", async () => {
    const fixture = createFixtureFetch();
    const fetchFn = async (input: Request) =>
      input.url === CUSTOMER_ITEM_URL
        ? new Response(
            JSON.stringify({
              type: "https://contentgrid.cloud/problems/not-found/entity-item",
              title: "Entity item not found",
              status: 404,
            }),
            { status: 404, headers: { "Content-Type": "application/problem+json" } },
          )
        : fixture.fetch(input);
    const { Wrapper } = createItemDetailTestHarness({ fetchFn });
    render(<EntityItemPreviewView entityName="customer" itemId="cust-001" />, { wrapper: Wrapper });

    expect(await screen.findByText("Entity item not found")).toBeInTheDocument();
  });

  it("shows not-found for an unknown entity", async () => {
    const { Wrapper } = createItemDetailTestHarness();
    render(<EntityItemPreviewView entityName="nope" itemId="1" />, { wrapper: Wrapper });

    expect(await screen.findByText(/No profile for entity "nope"/)).toBeInTheDocument();
  });
});
