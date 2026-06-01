import { Outlet, createRootRoute } from "@tanstack/react-router";
import { ExperimentalBanner } from "../components/experimental-banner";

export const Route = createRootRoute({
  component: () => (
    <>
      <ExperimentalBanner />
      <Outlet />
    </>
  ),
});
