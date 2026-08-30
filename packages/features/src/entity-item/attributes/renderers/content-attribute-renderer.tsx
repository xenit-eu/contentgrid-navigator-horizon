import type { ReactNode } from "react";
import { AttributeValue } from "@contentgrid/ui";

export interface ContentAttributeRendererProps {
  readonly metadata: { readonly filename: string | null; readonly length: number } | null;
  readonly icon?: ReactNode;
}

export function ContentAttributeRenderer({
  metadata,
  icon,
}: Readonly<ContentAttributeRendererProps>) {
  if (metadata == null) {
    return <AttributeValue />;
  }

  const sizeMb = (metadata.length / (1024 * 1024)).toFixed(1);
  const text = `${metadata.filename ?? "Untitled"} · ${sizeMb} MB`;
  const value = (
    <AttributeValue className="text-xs text-muted-foreground/80">{text}</AttributeValue>
  );

  if (!icon) {
    return value;
  }

  return (
    <span className="flex items-center gap-1.5">
      {icon}
      {value}
    </span>
  );
}
