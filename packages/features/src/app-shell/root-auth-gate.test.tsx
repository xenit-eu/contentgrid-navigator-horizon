import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppAuth } from "@contentgrid/navigator-data";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { RootAuthGate } from "./index";

vi.mock("@contentgrid/navigator-data", () => ({
  useAppAuth: vi.fn(),
  NavigatorDataProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@contentgrid/ui", () => ({
  SignInGate: ({ onSignIn }: { onSignIn: () => void }) => (
    <button onClick={onSignIn}>Sign in</button>
  ),
}));

afterEach(cleanup);

function makeAuthResult(overrides: Record<string, unknown> = {}): AppAuthResult {
  return {
    auth: {
      isLoading: false,
      isAuthenticated: true,
      user: null,
      error: undefined,
      signinRedirect: vi.fn(),
      ...overrides,
    },
    apiFetch: vi.fn(),
    contentFetch: vi.fn(),
    profileUrl: "https://api.example.com/profile",
  } as unknown as AppAuthResult;
}

describe("RootAuthGate", () => {
  it("renders nothing while auth is loading", () => {
    vi.mocked(useAppAuth).mockReturnValue(
      makeAuthResult({ isLoading: true, isAuthenticated: false }),
    );
    const { container } = render(
      <RootAuthGate>
        <div>content</div>
      </RootAuthGate>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the user token is expired and there is no error", () => {
    vi.mocked(useAppAuth).mockReturnValue(
      makeAuthResult({ user: { expired: true }, error: undefined }),
    );
    const { container } = render(
      <RootAuthGate>
        <div>content</div>
      </RootAuthGate>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders SignInGate when not authenticated", () => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult({ isAuthenticated: false }));
    render(
      <RootAuthGate>
        <div>content</div>
      </RootAuthGate>,
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    vi.mocked(useAppAuth).mockReturnValue(makeAuthResult());
    render(
      <RootAuthGate>
        <div>protected content</div>
      </RootAuthGate>,
    );
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });
});
