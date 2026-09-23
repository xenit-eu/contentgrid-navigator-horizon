import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RelationToManyRenderer } from "./relation-to-many-renderer";
import { relationToManyField } from "./test-fixtures";

const COLUMNS = [{ key: "name", header: "Name" }];
const ROW_A = { id: "https://api.example.com/products/1", data: { name: "Widget A" } };
const ROW_B = { id: "https://api.example.com/products/2", data: { name: "Widget B" } };

async function confirmUnlink(user: ReturnType<typeof userEvent.setup>, rowIndex = 0) {
  await user.click(screen.getAllByRole("button", { name: "Unlink" })[rowIndex]);
  const dialog = screen.getByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Unlink" }));
}

describe("RelationToManyRenderer", () => {
  it("starts collapsed when rows is empty, showing the Link button but not the empty-state text", () => {
    render(<RelationToManyRenderer {...relationToManyField()} />);
    expect(screen.queryByText("No items linked")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument();
  });

  it("shows 'No items linked' once expanded", async () => {
    const user = userEvent.setup();
    render(<RelationToManyRenderer {...relationToManyField()} />);
    await user.click(screen.getByRole("button", { name: /products/i }));
    expect(await screen.findByText("No items linked")).toBeInTheDocument();
  });

  it("starts expanded when rows is non-empty", () => {
    render(<RelationToManyRenderer {...relationToManyField({ rows: [ROW_A] })} />);
    expect(screen.getByText("Widget A")).toBeInTheDocument();
  });

  it("renders each row through the shared DataTable, using its column definitions", () => {
    render(
      <RelationToManyRenderer
        {...relationToManyField({ columns: COLUMNS, rows: [ROW_A, ROW_B] })}
      />,
    );
    expect(screen.getByText("Widget A")).toBeInTheDocument();
    expect(screen.getByText("Widget B")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
  });

  it("shows the linked-item count in the header chip", () => {
    render(
      <RelationToManyRenderer
        {...relationToManyField({ columns: COLUMNS, rows: [ROW_A, ROW_B] })}
      />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("hides the header's Link button when onLinkMore is not provided, even though it isn't readOnly", () => {
    render(<RelationToManyRenderer {...relationToManyField({ onLinkMore: undefined })} />);
    expect(screen.queryByRole("button", { name: "Link" })).not.toBeInTheDocument();
  });

  it("calls onUnlink with the confirmed row's id (its href) once the unlink dialog is confirmed", async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    render(
      <RelationToManyRenderer
        {...relationToManyField({ columns: COLUMNS, rows: [ROW_A, ROW_B], onUnlink })}
      />,
    );
    await confirmUnlink(user);
    expect(onUnlink).toHaveBeenCalledWith(ROW_A.id);
  });

  it("hides the unlink action and the link button when readOnly", () => {
    render(
      <RelationToManyRenderer
        {...relationToManyField({ readOnly: true, columns: COLUMNS, rows: [ROW_A] })}
      />,
    );
    expect(screen.queryByRole("button", { name: "Unlink" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Link/ })).not.toBeInTheDocument();
  });

  it("renders the error message when provided", () => {
    render(
      <RelationToManyRenderer
        {...relationToManyField({ error: "At least one product is required" })}
      />,
    );
    expect(screen.getByText("At least one product is required")).toBeInTheDocument();
  });

  describe("Unlink all", () => {
    it("hides Unlink all when onUnlinkAll is not provided", () => {
      render(
        <RelationToManyRenderer {...relationToManyField({ columns: COLUMNS, rows: [ROW_A] })} />,
      );
      expect(screen.queryByRole("button", { name: /unlink all/i })).not.toBeInTheDocument();
    });

    it("hides Unlink all when there are no rows, even with onUnlinkAll provided", () => {
      render(<RelationToManyRenderer {...relationToManyField({ onUnlinkAll: vi.fn() })} />);
      expect(screen.queryByRole("button", { name: /unlink all/i })).not.toBeInTheDocument();
    });

    it("hides Unlink all when readOnly", () => {
      render(
        <RelationToManyRenderer
          {...relationToManyField({
            readOnly: true,
            columns: COLUMNS,
            rows: [ROW_A],
            onUnlinkAll: vi.fn(),
          })}
        />,
      );
      expect(screen.queryByRole("button", { name: /unlink all/i })).not.toBeInTheDocument();
    });

    it("shows Unlink all once rows exist and does not call onUnlinkAll before confirming", async () => {
      const user = userEvent.setup();
      const onUnlinkAll = vi.fn();
      render(
        <RelationToManyRenderer
          {...relationToManyField({ columns: COLUMNS, rows: [ROW_A, ROW_B], onUnlinkAll })}
        />,
      );
      await user.click(screen.getByRole("button", { name: /unlink all/i }));
      expect(screen.getByText(/remove all 2 linked items/i)).toBeInTheDocument();
      expect(onUnlinkAll).not.toHaveBeenCalled();
    });

    it("calls onUnlinkAll once the confirm dialog is accepted", async () => {
      const user = userEvent.setup();
      const onUnlinkAll = vi.fn();
      render(
        <RelationToManyRenderer
          {...relationToManyField({ columns: COLUMNS, rows: [ROW_A, ROW_B], onUnlinkAll })}
        />,
      );
      await user.click(screen.getByRole("button", { name: /unlink all/i }));
      const dialog = screen.getByRole("alertdialog");
      await user.click(within(dialog).getByRole("button", { name: "Unlink all" }));
      expect(onUnlinkAll).toHaveBeenCalledOnce();
    });

    it("does not call onUnlinkAll when the confirm dialog is cancelled", async () => {
      const user = userEvent.setup();
      const onUnlinkAll = vi.fn();
      render(
        <RelationToManyRenderer
          {...relationToManyField({ columns: COLUMNS, rows: [ROW_A, ROW_B], onUnlinkAll })}
        />,
      );
      await user.click(screen.getByRole("button", { name: /unlink all/i }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onUnlinkAll).not.toHaveBeenCalled();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});
