import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import jsInPdfUrl from "./fixtures/js-in-pdf.pdf?url";
import minimalPdfUrl from "./fixtures/minimal.pdf?url";
import { PdfViewer } from "./pdf-viewer";
import { PdfViewerHarness, StoryFrame, wasmUrl } from "./pdf-viewer-story-helpers";

// ---------------------------------------------------------------------------
// WithInteraction — the one story whose play() actually runs in CI
// (apps/storybook/tests/interaction.spec.ts only picks up a story named
// exactly "With Interaction"). Split into its own file (same `title` as
// `pdf-viewer.stories.tsx`, so it sits under the same Storybook sidebar
// group): `pdf-viewer.stories.tsx` was growing past ~500 lines and this
// story alone is ~130 of them. Consolidates every behavioural check for this
// pattern, including the US3 search/print checks. Tagged `no-visual-test` so
// it is excluded from both the visual and a11y batch suites (a `play()`-
// bearing story races the a11y addon's own auto-scan against
// `AxeBuilder.analyze()`, and an in-flight `play()` mid-screenshot makes
// visual snapshots non-deterministic).
// ---------------------------------------------------------------------------

const meta = {
  title: "Patterns/PdfViewer",
  component: PdfViewer,
  // No `autodocs` tag here — `pdf-viewer.stories.tsx` already carries it for
  // this title; a second copy would generate a duplicate "Docs" page.
  args: {
    bytes: new ArrayBuffer(0),
    filename: "document.pdf",
    wasmUrl: "",
  },
} satisfies Meta<typeof PdfViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

function InteractionHarness() {
  const [doc, setDoc] = useState<{ src: string; filename: string }>({
    src: jsInPdfUrl,
    filename: "js-in-pdf.pdf",
  });

  return (
    <StoryFrame>
      <button
        type="button"
        data-testid="load-minimal-doc"
        className="sr-only"
        onClick={() => setDoc({ src: minimalPdfUrl, filename: "minimal.pdf" })}
      >
        Load minimal.pdf
      </button>
      <PdfViewerHarness
        key={doc.src}
        src={doc.src}
        filename={doc.filename}
        wasmUrl={wasmUrl}
        onDownload={fn()}
        onDocumentOpened={fn()}
        onLoadError={fn()}
      />
    </StoryFrame>
  );
}

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => <InteractionHarness />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    // Stub every legacy script-dialog entry point *before* the document with
    // the /OpenAction opens, so a synchronous call during load is caught too.
    let dialogFired = false;
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;
    const originalPrompt = window.prompt;
    window.alert = () => {
      dialogFired = true;
    };
    window.confirm = () => {
      dialogFired = true;
      return false;
    };
    window.prompt = () => {
      dialogFired = true;
      return null;
    };

    try {
      await step(
        "js-in-pdf.pdf's /OpenAction JavaScript never runs (FR-026/SC-005: PDFium has no JS engine)",
        async () => {
          await canvas.findByLabelText("Previous page", {}, { timeout: 10_000 });
          // Regression check for the "of 0" bug: on the very first document a
          // freshly created engine opens, the toolbar's total-page count must
          // reflect the real page count (this single-page fixture) and not a
          // stale "of 0" left over from a still-in-flight parse (see
          // use-pdf-viewer-state.ts's doc comment on `page`).
          await waitFor(() => expect(canvas.getByText("/ 1")).toBeInTheDocument(), {
            timeout: 10_000,
          });
          // Give the engine a moment past "opened" in case any scripting path
          // fires asynchronously.
          await new Promise((resolve) => setTimeout(resolve, 500));
          await expect(dialogFired).toBe(false);
        },
      );

      await step("switch to minimal.pdf for the remaining checks", async () => {
        await userEvent.click(canvas.getByTestId("load-minimal-doc"));
        const zoomIn = await canvas.findByLabelText("Zoom in", {}, { timeout: 10_000 });
        await waitFor(() => expect(zoomIn).toBeEnabled(), { timeout: 10_000 });
        await waitFor(() => expect(canvas.getByText("/ 1")).toBeInTheDocument(), {
          timeout: 10_000,
        });
      });

      // Search runs right after the document opens, before any other step —
      // Radix's Popover dismisses on an outside focus/interaction, and this
      // Storybook `play()` harness's own step-boundary transitions can
      // themselves trigger that (a testing-harness artifact, verified against
      // a real browser: the popover stays open and fully interactive for as
      // long as everything happens within one `step()` call, and only closes
      // exactly at the transition to the *next* `step()`). Keeping the whole
      // open→type→navigate→toggle→clear sequence in this one step, before any
      // other step boundary, avoids relying on the popover surviving a
      // transition it was never asked to survive.
      await step("search: open, type, navigate matches, toggles, clear", async () => {
        // The search popover, like the zoom preset menu below, renders
        // through a Radix Portal into `document.body` — only the trigger
        // button lives inside `canvasElement`.
        const searchTrigger = await canvas.findByLabelText("Search");
        await userEvent.click(searchTrigger);

        const searchInput = await within(document.body).findByLabelText("Search in document");
        await userEvent.type(searchInput, "Hello");
        await waitFor(() => expect(within(document.body).getByText("1 of 1")).toBeInTheDocument());

        // Enter / Shift+Enter navigate matches without throwing (a single
        // match wraps to itself both ways).
        await userEvent.type(searchInput, "{Enter}");
        await userEvent.type(searchInput, "{Shift>}{Enter}{/Shift}");

        const matchCase = await within(document.body).findByLabelText("Match case");
        await userEvent.click(matchCase);
        const wholeWord = await within(document.body).findByLabelText("Whole word");
        await userEvent.click(wholeWord);

        const clearButton = await within(document.body).findByLabelText("Clear search");
        await userEvent.click(clearButton);
        await waitFor(() => expect(searchInput).toHaveValue(""));
      });

      await step("page navigation: bounds and jump-to-page", async () => {
        // minimal.pdf is a single page — previous/next stay disabled at both
        // bounds simultaneously; the jump input still commits on Enter.
        await expect(await canvas.findByLabelText("Previous page")).toBeDisabled();
        await expect(await canvas.findByLabelText("Next page")).toBeDisabled();
        const pageInput = await canvas.findByLabelText("Current page");
        await userEvent.clear(pageInput);
        await userEvent.type(pageInput, "1{Enter}");
        await expect(pageInput).toHaveValue("1");
      });

      await step("zoom in/out and the preset menu", async () => {
        const zoomIn = await canvas.findByLabelText("Zoom in");
        const zoomLevel = await canvas.findByLabelText("Zoom level");
        const before = zoomLevel.textContent;
        await userEvent.click(zoomIn);
        await waitFor(() => expect(zoomLevel.textContent).not.toBe(before));

        const zoomOut = await canvas.findByLabelText("Zoom out");
        await userEvent.click(zoomOut);

        // The preset menu (like the search popover above) renders through a
        // Radix Portal into `document.body`, outside `canvasElement` — same
        // convention as `dropdown-menu.stories.tsx`'s interaction story.
        await userEvent.click(zoomLevel);
        await userEvent.click(await within(document.body).findByText("150%"));
        await waitFor(() => expect(zoomLevel).toHaveTextContent("150%"));
      });

      await step("download button is present and clickable", async () => {
        const download = await canvas.findByLabelText("Download");
        await userEvent.click(download);
      });

      await step("fullscreen toggle does not throw", async () => {
        const fullscreenButton = await canvas.findByLabelText("Enter fullscreen");
        await userEvent.click(fullscreenButton);
      });

      await step("print button is enabled once the document is ready", async () => {
        const printButton = await canvas.findByLabelText("Print");
        await expect(printButton).toBeEnabled();
      });
    } finally {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
      window.prompt = originalPrompt;
    }
  },
};
