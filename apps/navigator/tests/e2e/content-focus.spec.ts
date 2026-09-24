/**
 * E2E: the content-focus view (spec `002-pdf-viewer`, ACC-2902, T030).
 *
 * Architecture note — why this lives under `apps/navigator/tests/e2e/` but does NOT use
 * `./fixtures`'s `login`/`selectSidebarEntity`/`isSmallViewport`, and targets a second app:
 *
 * `EntityItemContentFocusView` (`@contentgrid/features/entity-item`, the `content-focus`
 * variation) is `x-stability: "experimental"` and is mounted only by `apps/navigator-experimental`
 * (`packages/features/src/entity-item/CLAUDE.md`). `apps/navigator` (this app) is the
 * generic, stable-only track — its own `CLAUDE.md` forbids importing experimental features, so
 * there is no route in this app that renders this view at all; a spec written against
 * `apps/navigator`'s own routes cannot exercise it. `apps/navigator/playwright.config.ts` also only
 * declares a single `webServer`/`baseURL` (the generic app, port 5173) — there is no second
 * project or base URL for `apps/navigator-experimental` (port 5174) to add a `use.baseURL`
 * override to.
 *
 * So this spec targets `apps/navigator-experimental`'s dev server directly, guarded by the
 * `NAVIGATOR_EXPERIMENTAL_URL` env var (skipped entirely when unset, across all four configured
 * Playwright projects — chromium/firefox × large/small viewport still apply, since those are
 * per-project browser/viewport settings, not tied to `baseURL`). To run it locally:
 *
 *   pnpm --filter navigator-experimental dev            # boots on http://localhost:5174
 *   NAVIGATOR_EXPERIMENTAL_URL=http://localhost:5174 pnpm --filter navigator exec playwright \
 *     test content-focus.spec.ts
 *
 * Unlike every other spec in this directory, no login step is needed and no `.env.test`
 * credentials are required: `apps/navigator-experimental/.env.development` runs its dev server
 * against MSW-mocked HAL data with dev-token auth (`VITE_USE_MOCK_API=true` / `VITE_DEV_TOKEN`,
 * see `apps/navigator-experimental/src/main.tsx`'s `enableMocking()`), never a real backend — so
 * this spec exercises the demo fixtures registered in `apps/navigator-experimental/src/mocks/
 * content-focus-handlers.ts` and `rendition-handlers.ts` (T031) instead of a seeded item on a real
 * ContentGrid application. The original task wording ("log in, open the fixture item with
 * fixtures/twenty-pages.pdf") assumed a real-backend flow; that fixture file is reused here as a
 * base64-embedded mock item (`doc-3`) instead, for the same reason — see the file for a fuller
 * account of why running this spec was not attempted in this environment.
 */
import { expect, test } from "@playwright/test";

const EXPERIMENTAL_URL = process.env.NAVIGATOR_EXPERIMENTAL_URL;

test.describe("Entity item content-focus view (apps/navigator-experimental)", () => {
  test.skip(
    !EXPERIMENTAL_URL,
    "Set NAVIGATOR_EXPERIMENTAL_URL to a running `pnpm --filter navigator-experimental dev` " +
      "instance (e.g. http://localhost:5174) to run this spec — see the file header comment.",
  );

  test.beforeEach(async ({ page }) => {
    // Same headless-pointer-capability override as navigator.spec.ts's beforeEach, needed for the
    // same reason: this view's ContentAttributeSelector is a Radix Select, which switches to
    // touch-only interaction under headless browsers without this.
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

  test("renders a stored single-page PDF with default breadcrumbs derived from the profile", async ({
    page,
  }) => {
    await page.goto(`${EXPERIMENTAL_URL}/document/doc-1`);

    // Default breadcrumbs (contracts/content-focus-view.md): Home / profileEntity.pluralName /
    // itemId — built by the view itself since the route passes no override.
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Documents" })).toBeVisible();
    await expect(page.getByRole("link", { name: "doc-1" })).toBeVisible();

    // The stored file is already a PDF (`isPdfMimetype`) — no rendition wait, straight to `ready`.
    await expect(page.getByRole("textbox", { name: "Current page" })).toHaveValue("1", {
      timeout: 15_000,
    });
    await expect(page.getByText("of 1")).toBeVisible();
  });

  test("navigates a multi-page document, zooms, switches content attributes, and downloads the selected file", async ({
    page,
  }) => {
    test.slow(); // real PDFium/WASM engine load, not the mocked one unit tests use.
    await page.goto(`${EXPERIMENTAL_URL}/document/doc-3`);

    const pageInput = page.getByRole("textbox", { name: "Current page" });
    await expect(pageInput).toHaveValue("1", { timeout: 15_000 });
    // doc-3's "file" attribute is the real twenty-pages.pdf fixture (also used by
    // apps/navigator/tests/e2e/fixtures/twenty-pages.pdf) — genuine multi-page navigation, not a
    // synthetic one-pager.
    await expect(page.getByText("of 20")).toBeVisible();

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(pageInput).toHaveValue("2");

    const zoomLevel = page.getByRole("button", { name: "Zoom level" });
    await expect(zoomLevel).toHaveText("100%");
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(zoomLevel).not.toHaveText("100%");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("twenty-pages.pdf");

    // doc-3 also has a second populated content attribute ("receipt") specifically so the
    // attribute panel (ContentAttributeSelector — content-attribute-selector.tsx) has something to
    // switch between; it renders nothing when an item has at most one content attribute.
    const attributeSelector = page.getByRole("combobox", { name: "Content attribute" });
    await expect(attributeSelector).toBeVisible();
    await expect(attributeSelector).toHaveText("File");

    await attributeSelector.click();
    await page.getByRole("option", { name: "Receipt" }).click();

    // FR-006: the previous attribute's document must never linger while the new one loads —
    // "of 20" (the old attribute's page count) must not still be showing once the new one is
    // ready, and the new attribute's own (1-page) count is what settles.
    await expect(page.getByText("of 1")).toBeVisible({ timeout: 15_000 });
  });

  test("shows a converted-preview badge for a rendition-backed non-PDF attribute", async ({
    page,
  }) => {
    test.slow(); // includes the mocked rendition service's poll cycle (T031 dev handlers).
    await page.goto(`${EXPERIMENTAL_URL}/document/doc-2`);

    // rendition-handlers.ts defaults to dev mode "ready" when localStorage carries no override —
    // a full request -> poll -> converted-PDF round trip through the mocked rendition service.
    await expect(page.getByText("Converted preview")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("textbox", { name: "Current page" })).toBeVisible();
  });

  test("respects the dev rendition-mode switch: invalid-conversion maps to previewUnavailable", async ({
    page,
  }) => {
    test.slow();
    // Exercises the actual localStorage-driven mode switch this app's dev handlers implement
    // (rendition-handlers.ts, T031) — a unit test only ever hits MSW directly and never proves
    // this switch itself works end to end.
    await page.addInitScript(() => {
      localStorage.setItem("contentgrid-navigator:dev-rendition-mode", "invalid-conversion");
    });
    await page.goto(`${EXPERIMENTAL_URL}/document/doc-2`);

    await expect(page.getByText(/Preview isn't available for .+ files\./)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Retry" })).not.toBeVisible();
  });
});
