import { createFileRoute, redirect } from "@tanstack/react-router";
import { NavigatorSettingsPage } from "@contentgrid/features/navigator-settings";

export const Route = createFileRoute("/config")({
  beforeLoad() {
    // This route is only available in local development builds.
    if (!import.meta.env.DEV) {
      throw redirect({ to: "/" });
    }
  },
  component: NavigatorSettingsPage,
});
