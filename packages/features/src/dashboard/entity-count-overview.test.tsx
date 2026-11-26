import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  type ProfileEntity,
  useEntityItemCollection,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { EntityCountOverview } from "./entity-count-overview";

vi.mock("../layout", () => ({ EntityIconBadge: () => null }));

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useLoadedProfileEntities: vi.fn(),
    useEntityItemCollection: vi.fn(() => ({ data: { totalItems: { count: 7 } } })),
  };
});

function mockCollection(collection: unknown) {
  vi.mocked(useEntityItemCollection).mockReturnValue(
    collection as ReturnType<typeof useEntityItemCollection>,
  );
}

function invoiceProfile() {
  return makeProfileEntity(
    { name: "invoice", title: "Invoice", description: "" },
    "https://example.com/profile/invoices",
    "invoice",
  );
}

function mockProfiles(
  profiles: readonly ProfileEntity[],
  { error = null, refetch = vi.fn() }: { error?: Error | null; refetch?: () => void } = {},
) {
  vi.mocked(useLoadedProfileEntities).mockReturnValue({
    profiles,
    isLoading: false,
    error,
    refetch,
  });
}

describe("EntityCountOverview", () => {
  it("reports the entity name when a card is clicked", async () => {
    mockProfiles([invoiceProfile()]);
    const onOpenEntity = vi.fn();
    render(<EntityCountOverview onOpenEntity={onOpenEntity} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onOpenEntity).toHaveBeenCalledExactlyOnceWith("invoice");
  });

  it("opens a card from the keyboard", async () => {
    mockProfiles([invoiceProfile()]);
    const onOpenEntity = vi.fn();
    render(<EntityCountOverview onOpenEntity={onOpenEntity} />);

    screen.getByRole("button").focus();
    await userEvent.keyboard("{Enter}");

    expect(onOpenEntity).toHaveBeenCalledExactlyOnceWith("invoice");
  });

  it("makes the card the only interactive element, with no create button", () => {
    mockProfiles([invoiceProfile()]);
    render(<EntityCountOverview onOpenEntity={vi.fn()} />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Create/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Create/)).not.toBeInTheDocument();
  });

  it.each([
    { name: "a single item", total: { count: 1, isEstimated: false }, text: "1 item" },
    { name: "zero", total: { count: 0, isEstimated: false }, text: "0 items" },
    { name: "a grouped count", total: { count: 1284, isEstimated: false }, text: "1 284 items" },
    {
      name: "an estimate",
      total: { count: 1204, isEstimated: true },
      text: "about 1 204 items",
    },
  ])("shows $name on the card's count line", ({ total, text }) => {
    mockCollection({ data: { totalItems: total }, isFetching: false });
    mockProfiles([invoiceProfile()]);
    render(<EntityCountOverview onOpenEntity={vi.fn()} />);

    expect(screen.getByRole("button")).toHaveTextContent(new RegExp(`${text}$`));
  });

  it("shows a dash while the count loads, then says when there is none", () => {
    mockProfiles([invoiceProfile()]);
    mockCollection({ data: undefined, isFetching: true });
    const { rerender } = render(<EntityCountOverview onOpenEntity={vi.fn()} />);
    expect(screen.getByText("—")).toBeInTheDocument();

    mockCollection({ data: undefined, isFetching: false });
    rerender(<EntityCountOverview onOpenEntity={vi.fn()} />);
    expect(screen.getByText("Count not available")).toBeInTheDocument();
  });

  it("shows an empty state without entities", () => {
    mockProfiles([]);
    render(<EntityCountOverview onOpenEntity={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Nothing to show yet" })).toBeInTheDocument();
  });

  it("offers to try again when the profile fails to load", async () => {
    const refetch = vi.fn();
    mockProfiles([], { error: new Error("Network error"), refetch });
    render(<EntityCountOverview onOpenEntity={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("The application couldn't be loaded");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(refetch).toHaveBeenCalledOnce();
  });
});
