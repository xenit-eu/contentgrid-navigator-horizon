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
import { ApplicationSelectorPage } from "./index";

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
      vi.mocked(getAppConfig).mockReturnValue({
        apiBaseUrl: "https://api.example.com",
        authority: "https://auth.example.com",
        clientId: "client-123",
      });

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

      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getAllByRole("button", { name: "Load Config" })[0]);

      // clientId only appears in the SettingsPanel, not in the app card
      expect(
        screen.getByText(productionApps[0].config.clientId, { exact: false }),
      ).toBeInTheDocument();
    });

    it("sets the default production extract URL when the selected app has none", async () => {
      const user = userEvent.setup();
      const appWithoutExtract = productionApps.find((a) => !a.config.extractServiceUrl)!;
      const index = productionApps.indexOf(appWithoutExtract);
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getAllByRole("button", { name: "Load Config" })[index]);

      expect(
        screen.getByText(/extract\.eu-west-1\.contentgrid\.cloud/, { exact: false }),
      ).toBeInTheDocument();
    });

    it("preserves an explicitly configured extract URL when mock extract is off", async () => {
      const user = userEvent.setup();
      const appWithExtract = productionApps.find((a) => !!a.config.extractServiceUrl)!;
      const index = productionApps.indexOf(appWithExtract);
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getAllByRole("button", { name: "Load Config" })[index]);

      expect(
        screen.getByText(appWithExtract.config.extractServiceUrl!, { exact: false }),
      ).toBeInTheDocument();
    });

    it("loads a sandbox app config into the panel", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Sandbox" }));
      await user.click(screen.getByRole("button", { name: "Load Config" }));

      // clientId only appears in the SettingsPanel, not in the app card
      expect(
        screen.getByText(sandboxApps[0].config.clientId, { exact: false }),
      ).toBeInTheDocument();
    });

    it("sets sandbox extract URL when loading a sandbox app", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Sandbox" }));
      await user.click(screen.getByRole("button", { name: "Load Config" }));

      expect(
        screen.getByText(/extract\.sandbox\.contentgrid\.cloud/, { exact: false }),
      ).toBeInTheDocument();
    });
  });

  describe("mock extract toggle", () => {
    it("switches to the mock extract URL after toggling when a production env is loaded", async () => {
      const user = userEvent.setup();
      const appWithoutExtract = productionApps.find((a) => !a.config.extractServiceUrl)!;
      const index = productionApps.indexOf(appWithoutExtract);
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getAllByRole("button", { name: "Load Config" })[index]);
      await user.click(screen.getByRole("checkbox", { name: /Use Mock Extract/i }));

      expect(
        screen.getByText(/mock-extract\.eu-west-1\.contentgrid\.cloud/, { exact: false }),
      ).toBeInTheDocument();
    });

    it("does not update the config when toggled before any app is loaded", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("checkbox", { name: /Use Mock Extract/i }));

      expect(screen.getByText("No configuration selected")).toBeInTheDocument();
    });
  });

  describe("Connect button", () => {
    it("calls signinWithNewConfig with the selected config", async () => {
      const user = userEvent.setup();
      render(<ApplicationSelectorPage />);

      await user.click(screen.getByRole("tab", { name: "Production" }));
      await user.click(screen.getAllByRole("button", { name: "Load Config" })[0]);
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
      await user.click(screen.getAllByRole("button", { name: "Load Config" })[0]);
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

      await user.click(screen.getByRole("button", { name: /Clear Runtime Config/i }));

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

      await user.click(screen.getByRole("button", { name: /Clear Runtime Config/i }));

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

      await user.click(screen.getByRole("button", { name: /Clear Runtime Config/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Session removal failed");
      });
    });
  });
});
