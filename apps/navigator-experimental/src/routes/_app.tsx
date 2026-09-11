import { createFileRoute } from "@tanstack/react-router";
import { SideBarLayout } from "@contentgrid/features/layout";
import { ExperimentalBanner } from "../components/experimental-banner";

export const Route = createFileRoute("/_app")({
  component: ExperimentalLayout,
});

function ExperimentalLayout() {
  return <SideBarLayout topChildren={<ExperimentalBanner />} />;
}
