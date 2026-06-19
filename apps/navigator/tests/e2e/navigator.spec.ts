/**
 * E2E navigator spec — ported from the original navigator (HZN-5D.9).
 *
 * MUI-specific selectors replaced with shadcn/ui equivalents:
 *   - Date pickers:  MUI popup + gridcell/option clicks  →  native <input type="date"> filled directly
 *   - Row actions:   inline icon buttons (getByLabel/getByTestId)  →  "Open menu" dropdown + menuitem
 *   - Pagination:    KeyboardArrowRight/LeftIcon testIds  →  aria-label "Go to next/previous page"
 *   - Sidebar:       "Expand sidebar" button  →  "Toggle Sidebar" (SidebarTrigger sr-only)
 *   - Clear field:   .MuiInputBase-root > .MuiButtonBase-root  →  getByRole('button', { name: 'Clear' })
 *   - Backdrop:      .MuiBackdrop-root.click()  →  keyboard.press('Escape')
 *   - EntityPicker:  "Link entity Items"  →  "Select" (single) / "Link" (multi)
 *   - RelationItem:  "Remove from selection" / "employee:…" button  →  "Unlink" / "View details"
 *   - Empty state:   "Create new item"  →  "Add new item to …" button
 *   - Link relation: "Link data" parent locator  →  "Link {Title}" (RelationSection empty-state button)
 *
 * Tests that depend on features not yet implemented (sidebar nav, entity collection/detail views,
 * create forms) will fail until those features are built in the other Phase 5D tickets.
 */
import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  // Override matchMedia so headless browsers report pointer:fine — prevents
  // shadcn/Radix components from switching to touch-only interaction modes.
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => {
        if (query === "(pointer: fine)") {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          };
        }
        return originalMatchMedia(query);
      },
    });
  });
});

test("Log in", async ({ login, selectSidebarEntity }) => {
  await login();
  await selectSidebarEntity("All attribute");
});

test("search form test", async ({ page, login, selectSidebarEntity }) => {
  await login();
  await selectSidebarEntity("All attribute");

  await page.getByRole("button", { name: "Filters" }).click();

  // Constrained-text enum — Radix Select renders with role="combobox"
  await page.getByRole("combobox", { name: /^Text$/ }).click();
  await page.getByRole("combobox", { name: /^Text$/ }).fill("e");
  await page.getByRole("option", { name: "Example Text" }).click();
  await expect(page.getByRole("combobox", { name: /^Text$/ })).toHaveValue("Example Text");

  // Clear the enum filter — ClearButton has sr-only "Clear" text
  await page.getByRole("button", { name: "Clear" }).first().click();

  // Long (number) spinbutton — HTML number inputs keep the same role
  await page.getByRole("spinbutton", { name: /^Long$/ }).click();
  await page.getByRole("spinbutton", { name: /^Long$/ }).fill("1234");
  await page.getByRole("spinbutton", { name: /^Long$/ }).click();
  await page.getByRole("spinbutton", { name: "Long: Min" }).fill("1");
  await page.getByRole("spinbutton", { name: "Long: Max" }).fill("2");
  await page.getByRole("spinbutton", { name: /^Long$/ }).click();

  // Double (number) spinbutton
  await page.getByRole("spinbutton", { name: /^Double$/ }).click();

  // Boolean enum
  await page.getByRole("combobox", { name: /Boolean/i }).click();
  await page.getByRole("option", { name: "Unset" }).click();
  await expect(page.getByRole("combobox", { name: /Boolean/i })).toContainText("Unset");

  // Date/datetime filter — the new app uses native <input type="date">, no popup picker.
  // FilterSidebar labels: "Datetime after" / "Datetime before" (from field name + direction).
  await page.getByLabel("Datetime after").fill("2024-01-15");
  await page.getByLabel("Datetime after").blur();
  await page.getByLabel("Datetime before").fill("2024-01-20");
  await page.getByLabel("Datetime before").blur();

  // Sort combobox
  await expect(page.getByRole("combobox", { name: "Sort" })).toBeVisible();
  await page.getByRole("combobox", { name: "Sort" }).click();
  await page.getByRole("option", { name: "Constrained text A→Z" }).click();

  await page.getByRole("button", { name: "Search" }).click();

  // DataTable empty-state button: "Add new item to {entityTitle}"
  await expect(page.getByRole("button", { name: /Add new item/i })).toBeVisible();
  await page.getByRole("button", { name: /Add new item/i }).click();
  await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
});

test("search form test2", async ({ page, login, selectSidebarEntity }) => {
  await login();
  await selectSidebarEntity("All attribute");

  await expect(page.getByRole("button", { name: "Create", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Filters" }).click();

  await page.getByRole("combobox", { name: /^Text$/ }).click();
  await page.getByRole("combobox", { name: /^Text$/ }).fill("test");
  await expect(page.getByRole("combobox", { name: /^Text$/ })).toBeVisible();

  await page.getByRole("spinbutton", { name: /^Long$/ }).click();
  await page.getByRole("spinbutton", { name: /^Long$/ }).fill("123");
  await expect(page.getByRole("spinbutton", { name: /^Long$/ })).toBeVisible();

  await expect(page.getByRole("combobox", { name: /Boolean/i })).toBeVisible();
  await page.getByRole("combobox", { name: /Boolean/i }).click();
  await page.getByRole("option", { name: "True" }).click();
  await expect(page.getByRole("combobox", { name: /Boolean/i })).toContainText("True");

  // Native date input — no popup
  await page.getByLabel("Datetime after").fill("2024-01-15");
  await page.getByLabel("Datetime after").blur();

  await page.getByRole("combobox", { name: "Constrained text" }).click();
  await page.getByRole("option", { name: "Constraint A" }).click();

  await page.getByRole("combobox", { name: "Sort" }).click();
  await page.getByRole("option", { name: "Datetime oldest first" }).click();

  await page.getByRole("button", { name: "Search" }).click();
});

test("search result", async ({ page, login, selectSidebarEntity }) => {
  await login();
  await selectSidebarEntity("All attribute");

  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByRole("combobox", { name: "Constrained text" }).click();
  await page.getByRole("option", { name: "Constraint A" }).click();

  await page.getByRole("combobox", { name: "Sort" }).click();
  await page.getByRole("option", { name: "Constrained text A→Z" }).click();

  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.getByRole("cell", { name: "Constraint A" }).first()).toBeVisible();
});

test("result table", async ({ page, login, selectSidebarEntity }) => {
  await login();
  await selectSidebarEntity("Read allowed");

  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByRole("button", { name: "Search" }).click();

  // DataTable renders — new implementation does not include CSV export or column toggle
  await expect(page.locator('[data-slot="table"]')).toBeVisible();

  // Pagination — shadcn Pagination uses aria-label links, not MUI icon buttons
  await page.getByRole("link", { name: "Go to next page" }).click();
  await expect(page.getByRole("link", { name: "Go to previous page" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to next page" })).toBeVisible();

  await page.getByRole("link", { name: "Go to next page" }).click();

  // Row action menu for "read-allowed-30" — three items visible
  const menuBtn30 = page
    .getByRole("row", { name: "read-allowed-30 lorem ipsum" })
    .getByRole("button", { name: "Open menu" });
  await menuBtn30.click();
  await expect(page.getByRole("menuitem", { name: "View details" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Delete row 31 → cancel in the AlertDialog confirmation
  const menuBtn31 = page
    .getByRole("row", { name: "read-allowed-31 lorem ipsum" })
    .getByRole("button", { name: "Open menu" });
  await menuBtn31.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("result table document preview @slow", async ({
  page,
  login,
  selectSidebarEntity,
  isSmallViewport,
}) => {
  test.slow();
  test.skip(
    isSmallViewport,
    "Skipping test on small viewport, there are no document previews on small viewport",
  );

  await login();
  await selectSidebarEntity("Order");

  // @embedpdf uses the same data-testid attributes as react-pdf-viewer
  await page.getByText("metadata.png [4.08 KB]").click();
  await expect(page.getByTestId("core__text-layer-0")).toBeVisible();

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Receipt" }).click();
  await expect(page.getByRole("img", { name: "metadata.png" })).toBeVisible();

  await page.locator('[role="combobox"]').filter({ hasText: "Receipt" }).click();
  await page.getByRole("option", { name: "Document" }).click();
  await expect(page.getByTestId("core__text-layer-0")).toBeVisible();

  await page.getByText("Bob.pdf [330.1 KB]").click();
  await expect(page.getByTestId("core__text-layer-0")).toBeVisible();

  await page.locator('[role="combobox"]').filter({ hasText: "Document" }).click();
  await page.getByRole("option", { name: "Document" }).click();
  await expect(page.getByTestId("core__text-layer-0")).toBeVisible();

  await page.locator('[role="combobox"]').filter({ hasText: "Document" }).click();
  await page.getByRole("option", { name: "Receipt" }).click();
  await expect(page.locator("#root")).toContainText("No file present.");

  await page.getByText("testdocx.docx [4.26 KB]").click();
  await expect(page.getByText("Receipt No file present.")).toBeVisible();

  await page.locator('[role="combobox"]').filter({ hasText: "Receipt" }).click();
  await page.getByRole("option", { name: "Document" }).click();
  await page.locator('[role="combobox"]').filter({ hasText: "Document" }).click();
  await page.getByRole("option", { name: "Receipt" }).click();
  await expect(page.getByText("Receipt No file present.")).toBeVisible();

  await page.getByText("Bob_broken.pdf [330.1 KB]").click();
  await page.locator('[role="combobox"]').filter({ hasText: "Receipt" }).click();
  await page.getByRole("option", { name: "Receipt" }).click();
  await expect(page.getByText("Receipt No file present.")).toBeVisible();

  await page.locator('[role="combobox"]').filter({ hasText: "Receipt" }).click();
  await page.getByRole("option", { name: "Document" }).click();
  await expect(page.getByText("The document is invalid or corrupted")).toBeVisible();

  await page.getByText("Bob_protected.pdf [330.46 KB]").click();
  await expect(page.getByTestId("core__viewer")).toBeVisible();

  await page.locator('[role="combobox"]').filter({ hasText: "Document" }).click();
  await page.getByRole("option", { name: "Receipt" }).click();
  await expect(page.getByText("Receipt No file present.")).toBeVisible();

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Document" }).click();
  await expect(page.getByText("This document requires a")).toBeVisible();
  await expect(page.getByTestId("core__asking-password-input")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
});

test("Test details no content", async ({ page, login, selectSidebarEntity }) => {
  await login();
  await selectSidebarEntity("Employee");

  // Row action → View details (replaces inline getByLabel('Details') icon button)
  await page
    .getByRole("row", { name: "Beatrix" })
    .getByRole("button", { name: "Open menu" })
    .click();
  await page.getByRole("menuitem", { name: "View details" }).click();

  await page.getByRole("tab", { name: "Managed orders" }).click();

  // RelationSection empty-state "Link" button opens EntityPicker dialog
  await page.getByRole("button", { name: /^Link/ }).first().click();
  await page.getByRole("cell", { name: "Bob.pdf [330.1 KB]" }).click();
  // EntityPicker confirm: "Select" (single) or "Link" (multi)
  await page.getByRole("button", { name: /^(Select|Link)/ }).click();
  await expect(page.getByText("Bob.pdf [330.1 KB]").first()).toBeVisible();

  await page.getByRole("tab", { name: "Colleague" }).click();
  await expect(page.getByText("John Doe")).toBeVisible();

  await page.getByRole("tab", { name: "Boss" }).click();
  await expect(page.getByText("Bob the boss")).toBeVisible();
});

test("Test details with content @slow", async ({ page, login, selectSidebarEntity }) => {
  test.slow();
  await login();
  await selectSidebarEntity("Order");

  await page
    .getByRole("row", { name: "testdocx.docx [4.26 KB]" })
    .getByRole("button", { name: "Open menu" })
    .click();
  await page.getByRole("menuitem", { name: "View details" }).click();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("spinbutton", { name: "Total amount" }).click();
  await page.getByRole("spinbutton", { name: "Total amount" }).fill("1000");
  await expect(page.getByText("Name: testdocx.docx")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click({ force: true });
});

test("Not allowed", async ({ page, login, selectSidebarEntity }) => {
  await login();
  await selectSidebarEntity("Not allowed");

  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Error:");

  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("Create Entity Basic Flow", async ({ page, login, selectSidebarEntity }) => {
  await login();
  await selectSidebarEntity("Create allowed");

  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("Name").click();
  await page.getByLabel("Name").fill("test-item");

  await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
  await expect(page.getByText("test-item")).toBeVisible();
});

test("Create Entity Continuous mode", async ({ page, login, selectSidebarEntity }) => {
  await login();
  await selectSidebarEntity("Create allowed");

  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("Name").click();
  await page.getByRole("checkbox", { name: "Keep creating entities" }).check();
  await expect(page.getByRole("checkbox", { name: "Keep creating entities" })).toBeChecked();

  await page.getByLabel("Name").fill("two");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Create-allowed has been")).toBeVisible();

  await page.getByLabel("Name").click();
  await page.getByRole("checkbox", { name: "Keep creating entities" }).uncheck();
  await expect(page.getByRole("checkbox", { name: "Keep creating entities" })).not.toBeChecked();
  await page.getByLabel("Name").click();
  await page.getByLabel("Name").fill("three");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("three")).toBeVisible();
});

test("Create mode", async ({ page, login, goToClassifyCreateInstancePage }) => {
  await login();
  await goToClassifyCreateInstancePage();

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Create allowed" }).click();
  await page.getByRole("paragraph").filter({ hasText: "Create allowed" }).click();
  await page.getByRole("option", { name: "Empty" }).click();

  // Close the open Radix dropdown — Escape replaces the MUI backdrop click
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Create" }).click();
});

test("Press cancel in create mode", async ({ page, login, goToClassifyCreateInstancePage }) => {
  await login();
  await goToClassifyCreateInstancePage();

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Create allowed" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByText("Search")).toBeVisible();
});

test("Link to create related entities", async ({ page, login, selectSidebarEntity }) => {
  await login();
  await selectSidebarEntity("Employee");

  await page.getByRole("button", { name: "Create", exact: true }).click();

  // RelationSection empty-state for the to-one "Boss" relation: "Link Boss" button
  await page.getByRole("button", { name: "Link Boss" }).click();

  // EntityPicker dialog
  await expect(page.locator("tbody")).toContainText("Order Manager");
  await page.getByText("Order Manager").first().click();
  // Confirm single-select
  await page.getByRole("button", { name: "Select" }).click();

  // After linking: "Unlink" (sr-only) and "View details" (sr-only) icon buttons appear
  await expect(page.getByRole("button", { name: "Unlink" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View details" })).toBeVisible();

  await page.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("cell", { name: "position:" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Order Manager" })).toBeVisible();

  // Unlink: first click opens AlertDialog, second "Unlink" confirms
  await page.getByRole("button", { name: "Unlink" }).click();
  await page.getByRole("button", { name: "Unlink" }).last().click();

  // Empty-state "Link Boss" button reappears
  await expect(page.getByRole("button", { name: "Link Boss" })).toBeVisible();
  await page.getByRole("button", { name: "Link Boss" }).click();
  // EntityPicker reopened — Create and Filters are visible inside
  await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
  await expect(page.getByText("Filters")).toBeVisible();
});

test("Create many relations entity", async ({ page, login, selectSidebarEntity }) => {
  await login();
  await selectSidebarEntity("Many relation");

  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("textbox", { name: "Name" }).first().click();
  await page.getByRole("textbox", { name: "Name" }).first().fill("created by playwright");

  // RelationSection: "Link Many to one" button (to-one relation field in create form)
  await page.getByRole("button", { name: "Link Many to one" }).click();
  await page.getByRole("cell", { name: "Item 1" }).click();
  await page.getByRole("button", { name: "Select" }).click();

  // The linked item is now shown; "View details" and "Unlink" buttons appear
  await expect(page.getByRole("button", { name: "View details" })).toBeVisible();

  await page.getByRole("button", { name: "Create" }).click();

  // Detail view tabs
  await page.getByRole("tab", { name: "? Many not allowed" }).click();
  await expect(page.getByText("You do not have permissions")).toBeVisible();

  await page.getByRole("tab", { name: "One relation" }).click();
  await expect(page.getByText("Item does not have a related")).toBeVisible();

  await page.getByRole("tab", { name: "Many to one items" }).click();
  await expect(page.getByText("Item 1")).toBeVisible();

  // Navigate to a related item via "View details" icon button in RelationSection
  await page.getByRole("button", { name: "View details" }).first().click();
  await expect(page.getByRole("tab", { name: "Receiver many related items" })).toBeVisible();
  await page.getByRole("tab", { name: "Receiver many related items" }).click();

  await page.getByRole("button", { name: "View details" }).first().click();
  await page.getByRole("tab", { name: "Many related items" }).click();
  await expect(page.getByText("Item 1", { exact: true })).toBeVisible();
});

test("search form over relations", async ({
  page,
  login,
  selectSidebarEntity,
  isSmallViewport,
}) => {
  await login();
  await selectSidebarEntity("Employee");

  await page.getByRole("button", { name: "Filters" }).click();

  // Relation filter: Radix Select combobox for the linked entity value
  await page.getByRole("combobox", { name: "Name", exact: true }).click();
  await page.getByRole("option", { name: "John Doe" }).click();

  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("cell", { name: "Order Manager" })).toBeVisible();
  await page.getByRole("cell", { name: "Order Manager" }).click();

  if (!isSmallViewport) {
    await page
      .getByRole("row", { name: "John Doe" })
      .getByRole("button", { name: "Open menu" })
      .click();
    await page.getByRole("menuitem", { name: "View details" }).click();
  }

  await page.getByRole("tab", { name: "Colleague" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Link/ })).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Filters" }).click();

  // Clear the relation filter — ClearButton sr-only text "Clear"
  await page.getByRole("button", { name: "Clear" }).first().click();

  await page.getByRole("combobox", { name: "Name", exact: true }).click();
  await page.getByRole("option", { name: "John Doe" }).click();

  // Nested relation sub-filters (Colleague: Name, Boss: Name) — TextFilter with a Label
  await page
    .getByRole("textbox", { name: "Colleague: Name" })
    .pressSequentially("John", { delay: 200 });
  await expect(page.getByRole("textbox", { name: "Colleague: Name" })).toHaveValue("John");

  await page.getByRole("textbox", { name: "Boss: Name" }).pressSequentially("Sam", { delay: 200 });
  await expect(page.getByRole("textbox", { name: "Boss: Name" })).toHaveValue("Sam");

  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("Sorry, no matching employee")).toBeVisible();
});

test("Clicking entity in sidebar from detail page returns to collection", async ({
  page,
  login,
  selectSidebarEntity,
}) => {
  await login();
  await selectSidebarEntity("Employee");

  await page
    .getByRole("row", { name: "Beatrix" })
    .getByRole("button", { name: "Open menu" })
    .click();
  await page.getByRole("menuitem", { name: "View details" }).click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

  // Clicking the entity in the sidebar from the detail page returns to collection
  await selectSidebarEntity("Employee");
  await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
});

test("Overview button navigates to home page", async ({
  page,
  login,
  selectSidebarEntity,
  goToOverviewPage,
}) => {
  await login();
  await selectSidebarEntity("Employee");
  await goToOverviewPage();
  await expect(page.getByText("Welcome to ContentGrid Navigator")).toBeVisible();
});

test.skip("File extract in create @slow", async ({ page, login, selectSidebarEntity }) => {
  // Currently disabled — blocked on the mock service of extract.
  // Also needs to verify the form is filled after extracted values come in.
  test.slow();
  await login();
  await selectSidebarEntity("All attribute");
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page
    .getByRole("button", { name: "Drop here to upload Upload" })
    .setInputFiles("tests/e2e/fixtures/Bob.pdf");
  await page.getByRole("button", { name: "Extract metadata" }).isVisible();
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/extract") && res.ok()),
    page.getByRole("button", { name: "extract" }).click(),
  ]);
  await expect(page.getByTestId("ContentGrid AIIcon").first()).toBeVisible();
});
