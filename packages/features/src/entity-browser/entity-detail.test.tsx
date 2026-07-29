import type { QueryClient } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerCursorHref } from "@contentgrid/navigator-data";
import { sampleInvoiceItems } from "@contentgrid/navigator-data/test-fixtures/hal/fixtures";
import { createListHandler } from "@contentgrid/navigator-data/test-fixtures/msw/handlers";
import { server } from "../../test-setup";
import {
  API_URL,
  emptyInvoicesList,
  invoiceProfileHandler,
  invoiceProfileHandlerNoCreate,
  profileRootHandler,
  renderEntityList,
  sampleItem,
} from "./test-support";

// Fails every request; used to exercise the collection's error state. The
// query has retry:3 with exponential backoff baked in, so callers must
// advance fake timers past the retries (see `renderWithRetriesFlushed`).
const failingInvoicesList = http.get(`${API_URL}/invoices`, () =>
  HttpResponse.json(null, { status: 500 }),
);

// Rejects a "stale" cursor with 400 (as the real API would for an expired
// token) and otherwise serves an empty first page.
function staleCursorInvoicesList() {
  return http.get(`${API_URL}/invoices`, ({ request }) => {
    const cursor = new URL(request.url).searchParams.get("_cursor");
    if (cursor === "stale") return HttpResponse.json(null, { status: 400 });
    return HttpResponse.json({
      _links: { self: { href: `${API_URL}/invoices` } },
      _embedded: { item: [] },
      page: { size: 0, total_items_exact: 0 },
    });
  });
}

async function renderWithRetriesFlushed(
  entry: string,
  seedQueryClient?: Parameters<typeof renderEntityList>[1],
) {
  vi.useFakeTimers();
  const result = renderEntityList(entry, seedQueryClient);
  await vi.runAllTimersAsync();
  vi.useRealTimers();
  return result;
}

describe("EntityDetailPage", () => {
  // Every test needs the profile root + invoice profile resolved; only the
  // collection response (or an override of one of these two) varies per test.
  beforeEach(() => {
    server.use(profileRootHandler(), invoiceProfileHandler());
  });

  it("shows entity detail page with Create button when profile has a create-form template", async () => {
    server.use(emptyInvoicesList);

    renderEntityList("/invoice");

    expect(await screen.findByText("All entities")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("does not show Create button when profile has no create-form template", async () => {
    server.use(invoiceProfileHandlerNoCreate(), emptyInvoicesList);

    renderEntityList("/invoice");

    await screen.findByText("All entities");
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
  });

  it("shows entity detail with items in a table, including an item count badge", async () => {
    server.use(
      createListHandler({
        url: `${API_URL}/invoices`,
        items: sampleInvoiceItems,
        page: { size: 20, total_items_exact: sampleInvoiceItems.length },
      }),
    );

    renderEntityList("/invoice");

    expect(await screen.findByText("INV-2024-001")).toBeInTheDocument();
    expect(await screen.findByText(/3 items/)).toBeInTheDocument();
  });

  it("shows error and no reset action when the collection fails without an active cursor", async () => {
    server.use(failingInvoicesList);

    await renderWithRetriesFlushed("/invoice");

    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back to first page/i })).not.toBeInTheDocument();
  });

  const staleCursorUrl = `${API_URL}/invoices?_cursor=stale`;

  // The route's `cursor` value is only ever an opaque token ("stale") — never
  // a URL. The data layer resolves it to the literal href it was minted from
  // via the cursor registry; seeding the registry here stands in for that
  // href having been registered by an earlier Next click in the same
  // session. The server then rejects the (registry-resolved) href as
  // stale/invalid, same as it would for any expired real-world cursor.
  function seedStaleCursor(queryClient: QueryClient) {
    registerCursorHref(queryClient, "invoice", "stale", staleCursorUrl);
  }

  it("offers a reset to the first page when a stale cursor fails to load", async () => {
    server.use(staleCursorInvoicesList());

    await renderWithRetriesFlushed("/invoice?cursor=stale", seedStaleCursor);

    expect(await screen.findByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back to first page/i })).toBeInTheDocument();
  });

  it("recovers to the first page when the reset action is clicked", async () => {
    server.use(staleCursorInvoicesList());

    await renderWithRetriesFlushed("/invoice?cursor=stale", seedStaleCursor);

    const resetButton = await screen.findByRole("button", { name: /back to first page/i });
    await userEvent.setup().click(resetButton);

    // Clearing the cursor switches the hook to the default (first-page) request,
    // which succeeds — the error and its reset action disappear.
    await screen.findByRole("table");
    expect(screen.queryByText(/Failed to load/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back to first page/i })).not.toBeInTheDocument();
  });

  it("shows pagination controls, and fetches the next page when Next is clicked", async () => {
    const user = userEvent.setup();
    const nextPageUrl = `${API_URL}/invoices?_cursor=page2token`;
    const page2Item = { id: "inv-999", number: "INV-2024-999" };

    // MSW matches handlers by path only (query string is ignored), so one
    // handler must branch on `_cursor` — two handlers on the same path would
    // only ever hit the first one (see demo-handlers.ts's same pattern).
    server.use(
      http.get(`${API_URL}/invoices`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("_cursor");
        const items = cursor === "page2token" ? [page2Item] : sampleInvoiceItems;
        return HttpResponse.json({
          _embedded: { item: items },
          _links: {
            self: { href: `${API_URL}/invoices` },
            ...(cursor === "page2token" ? {} : { next: { href: nextPageUrl } }),
          },
          page: { size: cursor === "page2token" ? 1 : 3, total_items_exact: 4 },
        });
      }),
    );

    renderEntityList("/invoice");

    const nextButton = await screen.findByRole("button", { name: "Next" });
    const prevButton = screen.getByRole("button", { name: "Previous" });

    // Previous is disabled (no prev on first page), Next is enabled
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    await user.click(nextButton);

    // Clicking Next registered "page2token" → nextPageUrl in the cursor
    // registry, and the route's `cursor=page2token` resolved through it —
    // no URL was ever constructed from the token.
    expect(await screen.findByText("INV-2024-999")).toBeInTheDocument();
  });

  it("falls back to the first page when the cursor in the route was never registered", async () => {
    // Simulates a bookmarked, shared, or freshly-reloaded URL: the cursor
    // registry (scoped to this render's QueryClient) has no entry for the
    // token, so the app must not guess a URL from it — it silently serves
    // the first page instead of erroring.
    server.use(
      createListHandler({
        url: `${API_URL}/invoices`,
        items: sampleInvoiceItems,
        page: { size: 20, total_items_exact: sampleInvoiceItems.length },
      }),
    );

    renderEntityList("/invoice?cursor=never-registered");

    expect(await screen.findByText("INV-2024-001")).toBeInTheDocument();
  });

  it("clicking back navigates to root overview", async () => {
    const user = userEvent.setup();

    server.use(emptyInvoicesList);

    renderEntityList("/invoice");

    const backButton = await screen.findByText("All entities");
    await user.click(backButton);

    // After navigating back, the overview header appears (no breadcrumb)
    expect(await screen.findByText("1 entity type available")).toBeInTheDocument();
  });

  it("table row click navigates to item detail", async () => {
    const user = userEvent.setup();

    server.use(
      createListHandler({
        url: `${API_URL}/invoices`,
        items: [sampleInvoiceItems[0]],
        page: { size: 1, total_items_exact: 1 },
      }),
      http.get(`${API_URL}/invoices/inv-001`, () => HttpResponse.json({ ...sampleItem })),
    );

    renderEntityList("/invoice");

    const cell = await screen.findByText("INV-2024-001");
    await user.click(cell);

    // After row click, navigate to /$entity/$itemId — breadcrumb shows itemId
    expect(await screen.findByText("inv-001")).toBeInTheDocument();
  });

  it("preserves the cursor when navigating to an item and back", async () => {
    const user = userEvent.setup();
    const page1Item = { id: "inv-999", number: "INV-2024-999" };
    const page2Url = `${API_URL}/invoices?_cursor=page2token`;

    // MSW matches handlers by path only (query string is ignored), so one
    // handler must branch on `_cursor` — two handlers on the same path would
    // only ever hit the first one (see demo-handlers.ts's same pattern).
    server.use(
      http.get(`${API_URL}/invoices`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("_cursor");
        const items = cursor === "page2token" ? [sampleItem] : [page1Item];
        return HttpResponse.json({
          _embedded: { item: items },
          _links: {
            self: { href: `${API_URL}/invoices` },
            ...(cursor === "page2token" ? {} : { next: { href: page2Url } }),
          },
          page: { size: 1, total_items_exact: 2 },
        });
      }),
      http.get(`${API_URL}/invoices/inv-001`, () => HttpResponse.json({ ...sampleItem })),
    );

    renderEntityList("/invoice");

    // Click Next: registers "page2token" → page2Url in the cursor registry,
    // then navigates to ?cursor=page2token, which resolves through it.
    const nextButton = await screen
      .findByText("INV-2024-999")
      .then(() => screen.findByRole("button", { name: "Next" }));
    await user.click(nextButton);

    const cell = await screen.findByText("INV-2024-001");
    await user.click(cell);
    expect(await screen.findByText("inv-001")).toBeInTheDocument();

    // Navigate back via the entity breadcrumb
    await user.click(screen.getAllByRole("button", { name: "Invoice" })[0]);

    // Should land back on the same (cursor) page — the registry survived the
    // route unmount/remount — not reset to the first one.
    expect(await screen.findByText("INV-2024-001")).toBeInTheDocument();
    expect(screen.queryByText("INV-2024-999")).not.toBeInTheDocument();
  });

  it("shows entity description when available", async () => {
    server.use(invoiceProfileHandler({ description: "All billing invoices" }), emptyInvoicesList);

    renderEntityList("/invoice");

    expect(await screen.findByText("All billing invoices")).toBeInTheDocument();
  });
});
