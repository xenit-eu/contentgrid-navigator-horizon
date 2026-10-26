import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { EntityCountOverview } from "./entity-count-overview";

vi.mock("../layout", () => ({ EntityIconBadge: () => null }));

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useLoadedProfileEntities: vi.fn(),
    useEntityItemCollection: () => ({ data: { totalItems: { count: 7 } } }),
  };
});

function invoiceProfile() {
  return makeProfileEntity(
    { name: "invoice", title: "Invoice", description: "" },
    "https://example.com/profile/invoices",
    "invoice",
  );
}

function mockProfiles(profiles: unknown[], isLoading = false) {
  vi.mocked(useLoadedProfileEntities).mockReturnValue({
    profiles,
    isLoading,
  } as unknown as ReturnType<typeof useLoadedProfileEntities>);
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

  it("shows an empty state without entities", () => {
    mockProfiles([]);
    render(<EntityCountOverview onOpenEntity={vi.fn()} />);

    expect(screen.getByText("No entities found")).toBeInTheDocument();
  });
});
