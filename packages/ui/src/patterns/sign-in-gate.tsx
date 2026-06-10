import { Button } from "../primitives/button";

export function SignInGate({ onSignIn }: Readonly<{ onSignIn: () => void }>) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Button onClick={onSignIn}>Sign in</Button>
    </div>
  );
}
