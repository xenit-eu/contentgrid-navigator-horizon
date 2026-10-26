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
  it("reports the entity name when a card is opened", async () => {
    mockProfiles([invoiceProfile()]);
    const onOpenEntity = vi.fn();
    render(<EntityCountOverview onOpenEntity={onOpenEntity} />);

    await userEvent.click(screen.getByText("7"));

    expect(onOpenEntity).toHaveBeenCalledWith("invoice");
  });

  it("reports the entity name from the create action without a second call from the card", async () => {
    mockProfiles([invoiceProfile()]);
    const onOpenEntity = vi.fn();
    render(<EntityCountOverview onOpenEntity={onOpenEntity} />);

    await userEvent.click(screen.getByText(/^Create /));

    expect(onOpenEntity).toHaveBeenCalledTimes(1);
    expect(onOpenEntity).toHaveBeenCalledWith("invoice");
  });

  it("shows an empty state without entities", () => {
    mockProfiles([]);
    render(<EntityCountOverview onOpenEntity={vi.fn()} />);

    expect(screen.getByText("No entities found")).toBeInTheDocument();
  });
});
