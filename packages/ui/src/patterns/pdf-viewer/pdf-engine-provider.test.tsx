import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfEngineProvider, useAmbientPdfEngineStatus } from "./pdf-engine-provider";

const mockUsePdfiumEngine = vi.fn();
vi.mock("@embedpdf/engines/react", () => ({
  usePdfiumEngine: (config: unknown) => mockUsePdfiumEngine(config),
}));

function StatusProbe() {
  const status = useAmbientPdfEngineStatus();
  return <div data-testid="status">{status?.status ?? "none"}</div>;
}

describe("PdfEngineProvider", () => {
  it("passes wasmUrl, worker:true and a disabled font fallback through to usePdfiumEngine", () => {
    mockUsePdfiumEngine.mockReturnValue({ engine: null, isLoading: true, error: null });
    render(
      <PdfEngineProvider wasmUrl="https://example.test/pdfium.wasm">
        <StatusProbe />
      </PdfEngineProvider>,
    );
    expect(mockUsePdfiumEngine).toHaveBeenCalledWith({
      wasmUrl: "https://example.test/pdfium.wasm",
      worker: true,
      fontFallback: { fonts: {} },
    });
  });

  it("exposes loading status while the engine initializes", () => {
    mockUsePdfiumEngine.mockReturnValue({ engine: null, isLoading: true, error: null });
    render(
      <PdfEngineProvider wasmUrl="https://example.test/pdfium.wasm">
        <StatusProbe />
      </PdfEngineProvider>,
    );
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
  });

  it("exposes the ready engine once loaded", () => {
    const engine = { closeAllDocuments: vi.fn(), destroy: vi.fn() };
    mockUsePdfiumEngine.mockReturnValue({ engine, isLoading: false, error: null });
    render(
      <PdfEngineProvider wasmUrl="https://example.test/pdfium.wasm">
        <StatusProbe />
      </PdfEngineProvider>,
    );
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
  });

  it("exposes an error status when the engine fails to load (upstream #632)", () => {
    mockUsePdfiumEngine.mockReturnValue({
      engine: null,
      isLoading: false,
      error: new Error("wasm fetch failed"),
    });
    render(
      <PdfEngineProvider wasmUrl="https://example.test/pdfium.wasm">
        <StatusProbe />
      </PdfEngineProvider>,
    );
    expect(screen.getByTestId("status")).toHaveTextContent("error");
  });

  it("returns undefined outside of any provider", () => {
    render(<StatusProbe />);
    expect(screen.getByTestId("status")).toHaveTextContent("none");
  });

  it("destroys a stale duplicate engine when a second one replaces it (Strict-Mode double-invoke guard, #700)", () => {
    const firstEngine = {
      closeAllDocuments: vi.fn().mockReturnValue({
        wait: (resolve: () => void) => resolve(),
      }),
      destroy: vi.fn(),
    };
    const secondEngine = { closeAllDocuments: vi.fn(), destroy: vi.fn() };

    mockUsePdfiumEngine.mockReturnValue({ engine: firstEngine, isLoading: false, error: null });
    const { rerender } = render(
      <PdfEngineProvider wasmUrl="https://example.test/pdfium.wasm">
        <StatusProbe />
      </PdfEngineProvider>,
    );

    mockUsePdfiumEngine.mockReturnValue({ engine: secondEngine, isLoading: false, error: null });
    rerender(
      <PdfEngineProvider wasmUrl="https://example.test/pdfium.wasm">
        <StatusProbe />
      </PdfEngineProvider>,
    );

    expect(firstEngine.closeAllDocuments).toHaveBeenCalled();
    expect(firstEngine.destroy).toHaveBeenCalled();
    expect(secondEngine.destroy).not.toHaveBeenCalled();
  });
});
