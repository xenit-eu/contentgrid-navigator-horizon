import { createFileRoute } from "@tanstack/react-router";
import { SidebarShell } from "@contentgrid/views/sidebar-shell";
import { DevAppSelectorLink } from "../components/dev-app-selector-link";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return <SidebarShell footer={import.meta.env.DEV ? <DevAppSelectorLink /> : undefined} />;
}
