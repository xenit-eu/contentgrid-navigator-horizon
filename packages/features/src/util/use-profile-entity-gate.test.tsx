import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRelationDemoHandlers } from "@contentgrid/navigator-data/test-fixtures/msw/relation-demo-handlers";
import { server } from "../../test-setup";
import { TEST_API_URL, makeNavigatorDataWrapper } from "./test-navigator-data-wrapper";
import { useProfileEntityGate } from "./use-profile-entity-gate";

describe("useProfileEntityGate", () => {
  it("is pending with a loading page, then ready with the profile", async () => {
    server.use(...createRelationDemoHandlers(TEST_API_URL, { requireBearer: false }));
    const { result } = renderHook(() => useProfileEntityGate("order"), {
      wrapper: makeNavigatorDataWrapper(),
    });
    expect(result.current.status).toBe("pending");
    expect(result.current.element).not.toBeNull();

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.profileEntity?.name).toBe("order");
    expect(result.current.element).toBeNull();
  });

  it("renders a not-found page with the given action for an unknown entity", async () => {
    server.use(...createRelationDemoHandlers(TEST_API_URL, { requireBearer: false }));
    const onClick = vi.fn();
    function Probe() {
      const gate = useProfileEntityGate("nope", {
        notFoundAction: { label: "Back to home", onClick },
      });
      return gate.status === "ready" ? <p>ready</p> : gate.element;
    }
    render(<Probe />, { wrapper: makeNavigatorDataWrapper() });
    expect(await screen.findByText(/Profile nope does not exist/)).toBeInTheDocument();
    screen.getByRole("button", { name: "Back to home" }).click();
    expect(onClick).toHaveBeenCalled();
  });
});
