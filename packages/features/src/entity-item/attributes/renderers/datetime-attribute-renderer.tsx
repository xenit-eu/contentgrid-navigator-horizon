import { ProfileAttributeType } from "@contentgrid/navigator-data";
import { AbsoluteDateAttributeRenderer } from "./absolute-date-attribute-renderer";

export interface DateTimeAttributeRendererProps {
  readonly value: string | null;
  readonly wrap?: boolean;
}

export function DateTimeAttributeRenderer({
  value,
  wrap,
}: Readonly<DateTimeAttributeRendererProps>) {
  return (
    <AbsoluteDateAttributeRenderer value={value} wrap={wrap} type={ProfileAttributeType.datetime} />
  );
}
