import { createFileRoute } from "@tanstack/react-router";
import { SideBarLayout } from "@contentgrid/features/layout";

export const Route = createFileRoute("/_app")({
  component: SideBarLayout,
});
