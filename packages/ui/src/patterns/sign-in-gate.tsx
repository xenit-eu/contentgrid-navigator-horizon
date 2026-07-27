import { Button } from "../primitives/button";

export function SignInGate({
  onSignIn,
  error,
}: Readonly<{ onSignIn: () => void; error?: string }>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      {error && (
        <div
          role="alert"
          className="max-w-md rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      <Button onClick={onSignIn}>Sign in</Button>
    </div>
  );
}
