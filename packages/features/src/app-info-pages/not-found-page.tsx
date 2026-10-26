import {
  Alert,
  AlertActionSection,
  AlertButton,
  AlertDescription,
  AlertTitle,
} from "@contentgrid/ui";

/** Rendered when no route matches the current URL; `onBackHome` is wired by the view that shows it. */
export function NotFoundPage({ onBackHome }: Readonly<{ onBackHome: () => void }>) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Alert tone="warning" className="w-full max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <AlertTitle>Page not found...</AlertTitle>
            <AlertDescription>This page doesn't exist.</AlertDescription>
          </div>
          <AlertActionSection>
            <AlertButton onClick={onBackHome}>Back to home</AlertButton>
          </AlertActionSection>
        </div>
      </Alert>
    </div>
  );
}
