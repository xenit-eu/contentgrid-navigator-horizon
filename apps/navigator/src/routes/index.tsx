import { createFileRoute } from "@tanstack/react-router";
import { ProfileInspector } from "@contentgrid/features/profile-inspector";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return <ProfileInspector />;
}
