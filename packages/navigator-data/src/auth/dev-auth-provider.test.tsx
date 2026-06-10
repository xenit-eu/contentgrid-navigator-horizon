import { cleanup, render, screen } from "@testing-library/react";
import { useAuth } from "react-oidc-context";
import { afterEach, describe, expect, it } from "vitest";
import { DevAuthProvider } from "./dev-auth-provider";

afterEach(cleanup);

function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="token">{auth.user?.access_token ?? "no-token"}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
    </div>
  );
}

describe("DevAuthProvider", () => {
  it("provides the dev token as user.access_token", () => {
    render(
      <DevAuthProvider token="my-dev-token">
        <AuthConsumer />
      </DevAuthProvider>,
    );
    expect(screen.getByTestId("token")).toHaveTextContent("my-dev-token");
  });

  it("reports isAuthenticated as true", () => {
    render(
      <DevAuthProvider token="any-token">
        <AuthConsumer />
      </DevAuthProvider>,
    );
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
  });

  it("renders children", () => {
    render(
      <DevAuthProvider token="tok">
        <span>child content</span>
      </DevAuthProvider>,
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("rebuilds the mock user when token prop changes", () => {
    const { rerender } = render(
      <DevAuthProvider token="token-a">
        <AuthConsumer />
      </DevAuthProvider>,
    );
    expect(screen.getByTestId("token")).toHaveTextContent("token-a");

    rerender(
      <DevAuthProvider token="token-b">
        <AuthConsumer />
      </DevAuthProvider>,
    );
    expect(screen.getByTestId("token")).toHaveTextContent("token-b");
  });
});
