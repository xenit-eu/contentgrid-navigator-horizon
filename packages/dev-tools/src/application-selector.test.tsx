import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEV_CONFIG_STORAGE_KEY,
  getAppConfig,
  productionApps,
  sandboxApps,
  signinWithNewConfig,
  useAuth,
} from "@contentgrid/navigator-data";
import { makeAppConfig } from "@contentgrid/navigator-data/test-fixtures/auth/app-config";
import { ApplicationSelectorPage } from "./application-selector";

// Not exported from the component; the value is confirmed by reading
// application-selector.tsx (`CUSTOM_CONFIG_STORAGE_KEY`).
const CUSTOM_CONFIG_STORAGE_KEY = "contentgrid:customConfig";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useAuth: vi.fn(),
    signinWithNewConfig: vi.fn(),
    getAppConfig: vi.fn(),
  };
});

function makeAuth(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isAuthenticated: true,
    user: null,
    error: undefined,
    signinRedirect: vi.fn().mockResolvedValue(undefined),
    removeUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("ApplicationSelectorPage", () => {
  const reloadMock = vi.fn();

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(makeAuth() as unknown as ReturnType<typeof useAuth>);
    vi.mocked(signinWithNewConfig).mockResolvedValue(undefined);
    vi.mocked(getAppConfig).mockImplementation(() => {
      throw new Error("no cached config");
    });
    vi.stubGlobal("location", { reload: reloadMock });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe("initial render", () => {
    it("shows no config selected when no dev override is stored", () => {
      render(<ApplicationSelectorPage />);

      expect(screen.getByText("No configuration selected")).toBeInTheDocument();
    });

    it("pre-populates the config panel when a dev override is stored and getAppConfig succeeds", () => {
      localStorage.setItem(DEV_CONFIG_STORAGE_KEY, "{}");
      vi.mocked(getAppConfig).mockReturnValue(
        makeAppConfig({ authority: "https://auth.example.com", clientId: "client-123" }),
      );

      render(<ApplicationSelectorPage />);

      expect(screen.getByText(/api\.example\.com/)).toBeInTheDocument();
      expect(screen.getByText(/auth\.example\.com/)).toBeInTheDocument();
      expect(screen.getByText(/client-123/)).toBeInTheDocument();
    });

    it("falls back to no config when DEV_CONFIG_STORAGE_KEY is present but getAppConfig throws", () => {
      localStorage.setItem(DEV_CONFIG_STORAGE_KEY, "{}");
      // getAppConfig already throws by default in beforeEach

      render(<ApplicationSelectorPage />);

      expect(screen.getByText("No configuration selected")).toBeInTheDocument();
    });
  });

  describe("app selection", () => {
    it("loads a production app config into the panel", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      // Production is the default tab, no need to click it explicitly, but
      // exercise the tab click anyway to cover tab navigation.
      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getByRole("button", { name: productionApps[0].name }));

      // clientId only appears in the review panel, not on the preset card
      expect(
        screen.getByText(productionApps[0].config.clientId, { exact: false }),
      ).toBeInTheDocument();
      // The selected preset card reflects its selected state
      expect(screen.getByRole("button", { name: productionApps[0].name })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("sets the default production extract URL when the selected app has none", async () => {
      const user = userEvent.setup();
      const appWithoutExtract = productionApps.find((a) => !a.config.extractServiceUrl)!;
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getByRole("button", { name: appWithoutExtract.name }));

      expect(
        screen.getByText(/extract\.eu-west-1\.contentgrid\.cloud/, { exact: false }),
      ).toBeInTheDocument();
    });

    it("preserves an explicitly configured extract URL when mock extract is off", async () => {
      const user = userEvent.setup();
      const appWithExtract = productionApps.find((a) => !!a.config.extractServiceUrl)!;
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getByRole("button", { name: appWithExtract.name }));

      expect(
        screen.getByText(appWithExtract.config.extractServiceUrl!, { exact: false }),
      ).toBeInTheDocument();
    });

    it("loads a sandbox app config into the panel", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Sandbox" }));
      await user.click(screen.getByRole("button", { name: sandboxApps[0].name }));

      // clientId only appears in the review panel, not on the preset card
      expect(
        screen.getByText(sandboxApps[0].config.clientId, { exact: false }),
      ).toBeInTheDocument();
    });

    it("sets sandbox extract URL when loading a sandbox app", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Sandbox" }));
      await user.click(screen.getByRole("button", { name: sandboxApps[0].name }));

      expect(
        screen.getByText(/extract\.sandbox\.contentgrid\.cloud/, { exact: false }),
      ).toBeInTheDocument();
    });
  });

  describe("mock extract toggle", () => {
    it("switches to the mock extract URL after toggling when a production env is loaded", async () => {
      const user = userEvent.setup();
      const appWithoutExtract = productionApps.find((a) => !a.config.extractServiceUrl)!;
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getByRole("button", { name: appWithoutExtract.name }));
      await user.click(screen.getByRole("checkbox", { name: /Use mock extract/i }));

      expect(
        screen.getByText(/mock-extract\.eu-west-1\.contentgrid\.cloud/, { exact: false }),
      ).toBeInTheDocument();
    });

    it("does not update the config when toggled before any app is loaded", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("checkbox", { name: /Use mock extract/i }));

      expect(screen.getByText("No configuration selected")).toBeInTheDocument();
    });

    it("overrides an explicit extract URL with the mock extract URL when mock extract is enabled before selecting a preset", async () => {
      const user = userEvent.setup();
      const appWithExtract = productionApps.find((a) => !!a.config.extractServiceUrl)!;
      render(<ApplicationSelectorPage />);

      // Enable mock extract first, while no config is loaded yet.
      await user.click(screen.getByRole("checkbox", { name: /Use mock extract/i }));
      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getByRole("button", { name: appWithExtract.name }));

      // Even though this preset already has an explicit extractServiceUrl configured,
      // mock extract being on takes the unconditional-override branch (not the
      // `??=` preserve-explicit branch), forcing the mock URL to be used.
      expect(
        screen.getByText(/mock-extract\.eu-west-1\.contentgrid\.cloud/, { exact: false }),
      ).toBeInTheDocument();
    });
  });

  describe("Connect button", () => {
    it("calls signinWithNewConfig with the selected config", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getByRole("button", { name: productionApps[0].name }));
      await user.click(screen.getByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(signinWithNewConfig).toHaveBeenCalledOnce();
        expect(signinWithNewConfig).toHaveBeenCalledWith(
          expect.objectContaining({ apiBaseUrl: productionApps[0].config.apiBaseUrl }),
        );
      });
    });

    it("falls back to auth.signinRedirect when no config is selected", async () => {
      const auth = makeAuth();
      vi.mocked(useAuth).mockReturnValue(auth as unknown as ReturnType<typeof useAuth>);
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(auth.signinRedirect).toHaveBeenCalledOnce();
        expect(signinWithNewConfig).not.toHaveBeenCalled();
      });
    });

    it("displays an error message when signinWithNewConfig rejects", async () => {
      vi.mocked(signinWithNewConfig).mockRejectedValue(new Error("OIDC discovery failed"));
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getByRole("button", { name: productionApps[0].name }));
      await user.click(screen.getByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("OIDC discovery failed");
      });
    });
  });

  describe("Clear button", () => {
    it("removes the dev config, signs the user out, and reloads the page", async () => {
      localStorage.setItem(
        DEV_CONFIG_STORAGE_KEY,
        JSON.stringify({ apiBaseUrl: "https://a.com", authority: "https://b.com", clientId: "c" }),
      );
      const auth = makeAuth();
      vi.mocked(useAuth).mockReturnValue(auth as unknown as ReturnType<typeof useAuth>);
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("button", { name: /Clear config & sign out/i }));

      await waitFor(() => {
        expect(localStorage.getItem(DEV_CONFIG_STORAGE_KEY)).toBeNull();
        expect(auth.removeUser).toHaveBeenCalledOnce();
        expect(reloadMock).toHaveBeenCalledOnce();
      });
    });

    it("clears the dev config from localStorage synchronously before awaiting removeUser", async () => {
      localStorage.setItem(
        DEV_CONFIG_STORAGE_KEY,
        JSON.stringify({ apiBaseUrl: "https://a.com", authority: "https://b.com", clientId: "c" }),
      );
      let configClearedBeforeRemoveUser = false;
      const auth = makeAuth({
        removeUser: vi.fn().mockImplementation(async () => {
          configClearedBeforeRemoveUser = localStorage.getItem(DEV_CONFIG_STORAGE_KEY) === null;
        }),
      });
      vi.mocked(useAuth).mockReturnValue(auth as unknown as ReturnType<typeof useAuth>);
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("button", { name: /Clear config & sign out/i }));

      await waitFor(() => {
        expect(auth.removeUser).toHaveBeenCalledOnce();
      });
      expect(configClearedBeforeRemoveUser).toBe(true);
    });

    it("displays an error message when removeUser rejects", async () => {
      const auth = makeAuth({
        removeUser: vi.fn().mockRejectedValue(new Error("Session removal failed")),
      });
      vi.mocked(useAuth).mockReturnValue(auth as unknown as ReturnType<typeof useAuth>);
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("button", { name: /Clear config & sign out/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Session removal failed");
      });
    });
  });

  describe("Custom tab", () => {
    it("renders empty fields and a disabled Load saved config button when nothing is saved", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Custom" }));

      expect(screen.getByLabelText("Base URL")).toHaveValue("");
      expect(screen.getByLabelText("Issuer URI")).toHaveValue("");
      expect(screen.getByLabelText("Client ID")).toHaveValue("");
      expect(screen.getByLabelText("Extract Service URL")).toHaveValue("");
      expect(screen.getByLabelText("Rendition URI Template")).toHaveValue("");
      expect(screen.getByRole("button", { name: "Load saved config" })).toBeDisabled();
    });

    it("updates fields as the user types and autosaves to localStorage under contentgrid:customConfig", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Custom" }));
      await user.type(screen.getByLabelText("Base URL"), "https://custom.example.com");
      await user.type(screen.getByLabelText("Issuer URI"), "https://issuer.example.com");
      await user.type(screen.getByLabelText("Client ID"), "custom-client");
      await user.type(screen.getByLabelText("Extract Service URL"), "https://extract.example.com");
      await user.type(
        screen.getByLabelText("Rendition URI Template"),
        "https://rendition.example.com{{?url}",
      );

      expect(screen.getByLabelText("Base URL")).toHaveValue("https://custom.example.com");
      expect(screen.getByLabelText("Issuer URI")).toHaveValue("https://issuer.example.com");
      expect(screen.getByLabelText("Client ID")).toHaveValue("custom-client");
      expect(screen.getByLabelText("Extract Service URL")).toHaveValue(
        "https://extract.example.com",
      );
      expect(screen.getByLabelText("Rendition URI Template")).toHaveValue(
        "https://rendition.example.com{?url}",
      );

      const saved = JSON.parse(localStorage.getItem(CUSTOM_CONFIG_STORAGE_KEY)!);
      expect(saved).toEqual({
        apiBaseUrl: "https://custom.example.com",
        authority: "https://issuer.example.com",
        clientId: "custom-client",
        extractServiceUrl: "https://extract.example.com",
        renditionUri: "https://rendition.example.com{?url}",
      });

      // Once saved, "Load saved config" becomes enabled.
      expect(screen.getByRole("button", { name: "Load saved config" })).toBeEnabled();
    });

    it("clearing an optional field back to empty stores undefined instead of an empty string", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Custom" }));
      await user.type(screen.getByLabelText("Extract Service URL"), "https://extract.example.com");
      await user.clear(screen.getByLabelText("Extract Service URL"));

      const saved = JSON.parse(localStorage.getItem(CUSTOM_CONFIG_STORAGE_KEY)!);
      expect(saved.extractServiceUrl).toBeUndefined();
    });

    it("pre-populates the form from a previously saved custom config in localStorage", async () => {
      localStorage.setItem(
        CUSTOM_CONFIG_STORAGE_KEY,
        JSON.stringify({
          apiBaseUrl: "https://saved.example.com",
          authority: "https://saved-issuer.example.com",
          clientId: "saved-client",
        }),
      );
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Custom" }));

      expect(screen.getByLabelText("Base URL")).toHaveValue("https://saved.example.com");
      expect(screen.getByLabelText("Client ID")).toHaveValue("saved-client");
      expect(screen.getByRole("button", { name: "Load saved config" })).toBeEnabled();
    });

    it("falls back to empty fields and a disabled Load saved config button when the saved custom config is malformed JSON", async () => {
      localStorage.setItem(CUSTOM_CONFIG_STORAGE_KEY, "{not-valid-json");
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Custom" }));

      expect(screen.getByLabelText("Base URL")).toHaveValue("");
      expect(screen.getByRole("button", { name: "Load saved config" })).toBeDisabled();
    });

    it("restores the saved custom config into the form when Load saved config is clicked", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      // Type a custom config (autosaves) and confirm it's reflected.
      await user.click(screen.getByRole("tab", { name: "Custom" }));
      await user.type(screen.getByLabelText("Base URL"), "https://custom.example.com");
      await user.type(screen.getByLabelText("Client ID"), "custom-client");

      // Switch to a preset, which replaces the currently displayed config...
      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getByRole("button", { name: productionApps[0].name }));

      // ...so switching back to Custom now shows the preset's values, not the saved custom ones.
      await user.click(screen.getByRole("tab", { name: "Custom" }));
      expect(screen.getByLabelText("Base URL")).toHaveValue(productionApps[0].config.apiBaseUrl);

      // Clicking "Load saved config" restores the previously autosaved custom values.
      await user.click(screen.getByRole("button", { name: "Load saved config" }));

      expect(screen.getByLabelText("Base URL")).toHaveValue("https://custom.example.com");
      expect(screen.getByLabelText("Client ID")).toHaveValue("custom-client");
    });

    it("calls signinWithNewConfig with the custom field values when Connect is clicked", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Custom" }));
      await user.type(screen.getByLabelText("Base URL"), "https://custom.example.com");
      await user.type(screen.getByLabelText("Issuer URI"), "https://issuer.example.com");
      await user.type(screen.getByLabelText("Client ID"), "custom-client");
      await user.click(screen.getByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(signinWithNewConfig).toHaveBeenCalledOnce();
        expect(signinWithNewConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            apiBaseUrl: "https://custom.example.com",
            authority: "https://issuer.example.com",
            clientId: "custom-client",
          }),
        );
      });
    });
  });
});
