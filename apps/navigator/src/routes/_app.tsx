import { createFileRoute } from "@tanstack/react-router";
import { SidebarShell } from "@contentgrid/views/sidebar-shell";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return <SidebarShell />;
}
