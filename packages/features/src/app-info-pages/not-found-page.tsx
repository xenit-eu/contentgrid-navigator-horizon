import { useNavigate } from "@tanstack/react-router";
import {
  Alert,
  AlertActionSection,
  AlertButton,
  AlertDescription,
  AlertTitle,
} from "@contentgrid/ui";

/** Rendered by the router when no route matches the current URL. */
export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Alert tone="warning" className="w-full max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <AlertTitle>Page not found...</AlertTitle>
            <AlertDescription>This page doesn't exist.</AlertDescription>
          </div>
          <AlertActionSection>
            <AlertButton onClick={() => navigate({ to: "/" })}>Back to home</AlertButton>
          </AlertActionSection>
        </div>
      </Alert>
    </div>
  );
}
