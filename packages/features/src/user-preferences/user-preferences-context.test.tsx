import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createMemoryStorage,
  createUserPreferencesStore,
} from "./entity-display-preferences-store";
import {
  UserPreferencesProvider,
  useEntityDisplayPreferencesStore,
} from "./user-preferences-context";

describe("UserPreferencesProvider", () => {
  it("serves the provided store to the selector hook", () => {
    const store = createUserPreferencesStore({ storage: createMemoryStorage() });
    const { result } = renderHook(
      () => useEntityDisplayPreferencesStore((state) => state.overrides),
      {
        wrapper: ({ children }) => (
          <UserPreferencesProvider store={store}>{children}</UserPreferencesProvider>
        ),
      },
    );
    expect(result.current).toEqual({});

    act(() => store.getState().setOverride("https://x/profile", "invoice", { color: "blue" }));

    expect(result.current["https://x/profile"].invoice).toEqual({ color: "blue" });
  });

  it("renders its children", () => {
    const store = createUserPreferencesStore({ storage: createMemoryStorage() });
    render(
      <UserPreferencesProvider store={store}>
        <p>child</p>
      </UserPreferencesProvider>,
    );
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("throws when the hook is used without a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() =>
      renderHook(() => useEntityDisplayPreferencesStore((state) => state.overrides)),
    ).toThrow(/UserPreferencesProvider/);
    spy.mockRestore();
  });
});
