import { type ReactNode, useState } from "react";
import { Alert, AlertDescription, AlertLinkButton, AlertTitle } from "@contentgrid/ui";

/**
 * Shared alert shell for every problem-detail variant: the status/title/detail
 * header, a `children` slot for kind-specific body content, and — when `type`
 * (the RFC 9457 `type` URI) is known — a "View problem type" link. Not
 * exported from the package barrel — internal to the `*-alert` components in
 * this directory.
 */
export function ProblemAlertFrame({
  status,
  title,
  detail,
  type,
  onClose,
  className,
  children,
}: Readonly<{
  status?: number;
  title: string;
  detail?: string;
  type?: string;
  onClose?: () => void;
  className?: string;
  children?: ReactNode;
}>) {
  const identity = `${status ?? ""}|${title}|${detail ?? ""}`;
  const [dismissedIdentity, setDismissedIdentity] = useState<string | null>(null);

  if (dismissedIdentity === identity) {
    return null;
  }

  function handleClose() {
    setDismissedIdentity(identity);
    onClose?.();
  }

  return (
    <Alert tone="error" onClose={handleClose} className={className}>
      <div className="flex items-center justify-between gap-2">
        <AlertTitle>
          {status !== undefined && <span className="tabular-nums">{status}</span>}
          {title}
        </AlertTitle>
        {type && <AlertLinkButton href={type} label="View problem type documentation" />}
      </div>
      {detail && detail !== title && <AlertDescription>{detail}</AlertDescription>}
      {children}
    </Alert>
  );
}
