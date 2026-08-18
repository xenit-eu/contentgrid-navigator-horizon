import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppAuthResult } from "@contentgrid/navigator-data";
import { useAppAuth } from "@contentgrid/navigator-data";
import { AuthShell } from ".";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useAppAuth: vi.fn(),
    NavigatorDataProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

vi.mock("@contentgrid/ui", () => ({
  SignInGate: ({ onSignIn, error }: { onSignIn: () => void; error?: string }) => (
    <>
      {error && <p>{error}</p>}
      <button onClick={onSignIn}>Sign in</button>
    </>
  ),
}));

// Renders AuthShell with a fully-authenticated/ready auth result by default;
// pass overrides to drive it into the loading/expired/unauthenticated branches.
function renderAuthShell(authOverrides: Record<string, unknown> = {}) {
  vi.mocked(useAppAuth).mockReturnValue({
    auth: {
      isLoading: false,
      isAuthenticated: true,
      user: null,
      error: undefined,
      signinRedirect: vi.fn(),
      ...authOverrides,
    },
    apiFetch: vi.fn(),
    profileUrl: "https://api.example.com/profile",
  } as unknown as AppAuthResult);

  return render(
    <AuthShell>
      <div>content</div>
    </AuthShell>,
  );
}

describe("AuthShell", () => {
  it("renders nothing while auth is loading", () => {
    const { container } = renderAuthShell({ isLoading: true, isAuthenticated: false });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the user token is expired and there is no error", () => {
    const { container } = renderAuthShell({ user: { expired: true }, error: undefined });
    expect(container.firstChild).toBeNull();
  });

  it("renders SignInGate when the user is not authenticated", () => {
    renderAuthShell({ isAuthenticated: false });
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("surfaces the error message on SignInGate when auth failed", () => {
    renderAuthShell({
      isAuthenticated: false,
      error: new Error("Token exchange failed"),
    });
    expect(screen.getByText("Token exchange failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    renderAuthShell();
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
