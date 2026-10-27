import { createFileRoute } from "@tanstack/react-router";
import { SidebarShell } from "@contentgrid/views/sidebar-shell";
import { ExperimentalBanner } from "../components/experimental-banner";

export const Route = createFileRoute("/_app")({
  component: ExperimentalLayout,
});

function ExperimentalLayout() {
  return <SidebarShell topChildren={<ExperimentalBanner />} />;
}
