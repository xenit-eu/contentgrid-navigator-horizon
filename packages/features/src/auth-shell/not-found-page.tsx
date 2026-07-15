import { useNavigate } from "@tanstack/react-router";
import { ErrorPage } from "@contentgrid/ui";

/** Rendered by the router when no route matches the current URL. */
export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <ErrorPage
      message="This page doesn't exist."
      onRetry={() => navigate({ to: "/" })}
      retryLabel="Back to home"
    />
  );
}
